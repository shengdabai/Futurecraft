import Foundation
import Combine
import AuthenticationServices
import UIKit

/// 认证管理器
/// 负责处理 Sign in with Apple、后端登录验证等
class AuthManager: NSObject, ObservableObject {
    static let shared = AuthManager()
    
    @Published var isAuthenticating = false
    @Published var authError: String?
    
    private var authContinuation: CheckedContinuation<String, Error>?
    
    private override init() {
        super.init()
    }
    
    // MARK: - Sign in with Apple
    
    /// 执行 Sign in with Apple 登录
    /// 返回 Apple identity token，用于向后端验证
    func performAppleLogin() async throws -> AppleLoginResult {
        return try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.main.async {
                self.isAuthenticating = true
                self.authError = nil
                
                let provider = ASAuthorizationAppleIDProvider()
                let request = provider.createRequest()
                request.requestedScopes = [.email, .fullName]
                
                let controller = ASAuthorizationController(authorizationRequests: [request])
                controller.delegate = self
                controller.presentationContextProvider = self
                
                // Store continuation for delegate callback
                self.appleLoginContinuation = continuation
                
                controller.performRequests()
            }
        }
    }
    
    private var appleLoginContinuation: CheckedContinuation<AppleLoginResult, Error>?
    
    // MARK: - Backend Authentication
    
    /// 向后端发送 Apple identity token 进行验证
    func authenticateWithBackend(appleResult: AppleLoginResult, region: Region) async throws -> AuthResponse {
        let baseURL = region.baseURL
        let url = URL(string: "\(baseURL)/auth/apple")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "identityToken": appleResult.identityToken,
            "authorizationCode": appleResult.authorizationCode,
            "email": appleResult.email ?? "",
            "fullName": appleResult.fullName ?? ""
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw AuthError.serverError
        }
        
        let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
        
        // 安全存储 Token
        _ = KeychainManager.shared.saveAccessToken(authResponse.accessToken)
        _ = KeychainManager.shared.saveRefreshToken(authResponse.refreshToken)
        _ = KeychainManager.shared.saveUserId(authResponse.user.id)
        
        return authResponse
    }
    
    /// 游客登录
    func loginAsGuest(region: Region) async throws -> AuthResponse {
        let baseURL = region.baseURL
        let url = URL(string: "\(baseURL)/auth/guest")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // 如果有之前的 guest ID，发送它以恢复会话
        let existingGuestId = UserDefaults.standard.string(forKey: Constants.Keys.guestId)
        let body: [String: Any] = ["guestId": existingGuestId ?? ""]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw AuthError.serverError
        }
        
        let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
        
        // 保存 guest ID 供下次使用
        UserDefaults.standard.set(authResponse.user.id, forKey: Constants.Keys.guestId)
        
        // 安全存储 Token
        _ = KeychainManager.shared.saveAccessToken(authResponse.accessToken)
        _ = KeychainManager.shared.saveUserId(authResponse.user.id)
        
        return authResponse
    }
    
    /// 尝试恢复已有会话
    func tryRestoreSession(region: Region) async -> User? {
        guard let accessToken = KeychainManager.shared.getAccessToken(),
              let userId = KeychainManager.shared.getUserId() else {
            return nil
        }
        
        // 验证 token 是否仍有效
        let baseURL = region.baseURL
        guard let url = URL(string: "\(baseURL)/auth/me") else { return nil }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                // Token 无效，清除
                KeychainManager.shared.clearAllTokens()
                return nil
            }
            
            let user = try JSONDecoder().decode(User.self, from: data)
            return user
        } catch {
            return nil
        }
    }
    
    /// 登出
    func logout() {
        KeychainManager.shared.clearAllTokens()
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension AuthManager: ASAuthorizationControllerDelegate {
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        DispatchQueue.main.async {
            self.isAuthenticating = false
        }
        
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8),
              let authCodeData = credential.authorizationCode,
              let authCode = String(data: authCodeData, encoding: .utf8) else {
            appleLoginContinuation?.resume(throwing: AuthError.invalidCredential)
            appleLoginContinuation = nil
            return
        }
        
        let fullName: String?
        if let nameComponents = credential.fullName {
            fullName = [nameComponents.givenName, nameComponents.familyName]
                .compactMap { $0 }
                .joined(separator: " ")
        } else {
            fullName = nil
        }
        
        let result = AppleLoginResult(
            identityToken: identityToken,
            authorizationCode: authCode,
            email: credential.email,
            fullName: fullName?.isEmpty == true ? nil : fullName,
            userIdentifier: credential.user
        )
        
        appleLoginContinuation?.resume(returning: result)
        appleLoginContinuation = nil
    }
    
    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        DispatchQueue.main.async {
            self.isAuthenticating = false
            self.authError = error.localizedDescription
        }
        
        appleLoginContinuation?.resume(throwing: error)
        appleLoginContinuation = nil
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

extension AuthManager: ASAuthorizationControllerPresentationContextProviding {
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        // 获取当前的 key window
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else {
            return UIWindow()
        }
        return window
    }
}

// MARK: - Models

struct AppleLoginResult {
    let identityToken: String
    let authorizationCode: String
    let email: String?
    let fullName: String?
    let userIdentifier: String
}

struct AuthResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let user: User
}

enum AuthError: Error, LocalizedError {
    case invalidCredential
    case serverError
    case networkError
    
    var errorDescription: String? {
        switch self {
        case .invalidCredential:
            return "Invalid credential received"
        case .serverError:
            return "Server error occurred"
        case .networkError:
            return "Network error occurred"
        }
    }
}
