import SwiftUI

struct AIChatView: View {
    let mode: String // "Tutor" or "Boss"
    @State private var messages: [ViewChatMessage] = []
    @State private var inputText: String = ""
    @State private var isTyping: Bool = false
    
    struct ViewChatMessage: Identifiable {
        let id = UUID()
        let text: String
        let isUser: Bool
    }
    
    var body: some View {
        VStack {
            // Chat History
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(messages) { message in
                            HStack {
                                if message.isUser {
                                    Spacer()
                                    Text(message.text)
                                        .padding()
                                        .background(Color.blue)
                                        .foregroundColor(.white)
                                        .cornerRadius(16)
                                        .cornerRadius(4, corners: .bottomRight)
                                } else {
                                    VStack(alignment: .leading) {
                                        Text(mode == "Tutor" ? "AI Mentor" : "Boss Interviewer")
                                            .font(.caption)
                                            .foregroundColor(.gray)
                                            .padding(.leading, 8)
                                        
                                        TypewriterText(text: message.text) // Re-use our typewriter effect
                                            .padding()
                                            .background(Color.white.opacity(0.15))
                                            .foregroundColor(.white)
                                            .cornerRadius(16)
                                            .cornerRadius(4, corners: .bottomLeft)
                                    }
                                    Spacer()
                                }
                            }
                            .padding(.horizontal)
                            .id(message.id)
                        }
                    }
                    .padding(.top)
                }
                .onChange(of: messages.count) { _ in
                    if let lastId = messages.last?.id {
                        withAnimation {
                            proxy.scrollTo(lastId, anchor: .bottom)
                        }
                    }
                }
            }
            
            // Input Area
            HStack {
                TextField("Type your response...", text: $inputText)
                    .padding(10)
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(20)
                    .foregroundColor(.white)
                
                Button(action: sendMessage) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 32))
                        .foregroundColor(inputText.isEmpty ? .gray : .purple)
                }
                .disabled(inputText.isEmpty || isTyping)
            }
            .padding()
            .background(Color.black.opacity(0.8))
        }
        .navigationTitle(mode == "Tutor" ? "Career Mentor" : "Final Interview")
        .background(Color.black.edgesIgnoringSafeArea(.all))
        .onAppear {
            if messages.isEmpty {
                // Initial greeting
                let initialText = mode == "Tutor" 
                    ? "Greetings. I am your career mentor. paradoxes in your logic detected? Let's discuss your path."
                    : "So, you think you have what it takes? Explain to me why I shouldn't fire you right now."
                
                messages.append(ViewChatMessage(text: initialText, isUser: false))
            }
        }
    }
    
    func sendMessage() {
        let userMessage = ViewChatMessage(text: inputText, isUser: true)
        messages.append(userMessage)
        let query = inputText
        inputText = ""
        isTyping = true
        
        // Simulate AI Response
        Task {
            do {
                let context = ChatContext(
                    jobTitle: mode == "Tutor" ? "Career exploration" : "Interview simulation",
                    isBossMode: mode != "Tutor",
                    history: messages.map {
                        ChatMessage(role: $0.isUser ? "user" : "assistant", content: $0.text)
                    },
                    language: Locale.current.language.languageCode?.identifier ?? "en"
                )
                let response = try await AIService.shared.chat(message: query, context: context)
                DispatchQueue.main.async {
                    messages.append(ViewChatMessage(text: response.message, isUser: false))
                    isTyping = false
                }
            } catch {
                isTyping = false
            }
        }
    }
}

// Extension for partial corner radius
extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape( RoundedCorner(radius: radius, corners: corners) )
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(roundedRect: rect, byRoundingCorners: corners, cornerRadii: CGSize(width: radius, height: radius))
        return Path(path.cgPath)
    }
}
