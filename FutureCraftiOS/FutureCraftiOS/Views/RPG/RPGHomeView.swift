import SwiftUI

struct RPGHomeView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if let rpgProfile = appState.currentUser?.rpgProfile {
                    // Dashboard
                    VStack(alignment: .leading) {
                        HStack {
                            Text("Welcome back, \(rpgProfile.playerName)")
                                .font(.title2)
                                .bold()
                                .foregroundColor(.white)
                            Spacer()
                            NavigationLink(destination: SoulScanView()) {
                                Image(systemName: "pencil.circle")
                                    .foregroundColor(.purple)
                            }
                        }
                        
                        Text("Archetype: \(rpgProfile.archetype ?? "Novice")")
                            .font(.headline)
                            .foregroundColor(.purple)
                        
                        StatsView(stats: rpgProfile.stats ?? RPGStats(intelligence: 0, creativity: 0, charisma: 0, stamina: 0, tech: 0))
                            .padding(.top)
                    }
                    .padding()
                    .background(LinearGradient(gradient: Gradient(colors: [Color.white.opacity(0.15), Color.white.opacity(0.05)]), startPoint: .topLeading, endPoint: .bottomTrailing))
                    .cornerRadius(16)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.white.opacity(0.1), lineWidth: 1))
                    
                    // Multiverse Map / Simulations
                    VStack(alignment: .leading) {
                        Text("Simulations")
                            .font(.headline)
                            .foregroundColor(.gray)
                            .padding(.horizontal)
                        
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 16) {
                                NavigationLink(destination: SimulationGameView(scenarioTitle: "Data Mercenary")) {
                                    SimulationCard(title: "Cyber Security Analyst", difficulty: "Hard", color: .blue)
                                }
                                
                                NavigationLink(destination: SimulationGameView(scenarioTitle: "Digital Artist")) {
                                    SimulationCard(title: "Digital Artist", difficulty: "Medium", color: .pink)
                                }
                                
                                NavigationLink(destination: SimulationGameView(scenarioTitle: "AI Ethics Officer")) {
                                    SimulationCard(title: "AI Ethics Officer", difficulty: "Easy", color: .green)
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                    
                    // AI Mentors
                    VStack(alignment: .leading) {
                        Text("Mentorship")
                            .font(.headline)
                            .foregroundColor(.gray)
                            .padding(.horizontal)
                        
                        HStack(spacing: 16) {
                            NavigationLink(destination: AIChatView(mode: "Tutor")) {
                                MentorCard(title: "AI Tutor", icon: "brain.head.profile", description: "Get career advice")
                            }
                            
                            NavigationLink(destination: AIChatView(mode: "Boss")) {
                                MentorCard(title: "Boss Battle", icon: "briefcase.fill", description: "Mock Interview")
                            }
                        }
                        .padding(.horizontal)
                    }
                    
                } else {
                    // Soul Scan Call to Action
                    VStack(spacing: 20) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 80))
                            .foregroundColor(.purple)
                            .shadow(color: .purple.opacity(0.5), radius: 20, x: 0, y: 0)
                        
                        Text("Begin Your Journey")
                            .font(.title)
                            .bold()
                            .foregroundColor(.white)
                        
                        Text("Complete the Soul Scan to discover your career archetype.")
                            .multilineTextAlignment(.center)
                            .foregroundColor(.gray)
                            .padding(.horizontal)
                        
                        NavigationLink(destination: SoulScanView()) {
                            Text("Start Soul Scan")
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(width: 200, height: 50)
                                .background(LinearGradient(gradient: Gradient(colors: [.blue, .purple]), startPoint: .leading, endPoint: .trailing))
                                .cornerRadius(25)
                                .shadow(radius: 10)
                        }
                    }
                    .padding(.top, 60)
                }
            }
            .padding(.top)
        }
        .background(Color.black.edgesIgnoringSafeArea(.all))
        .navigationTitle("Career RPG")
    }
}

struct StatsView: View {
    let stats: RPGStats
    
    var body: some View {
        HStack {
            StatItem(label: "INT", value: stats.intelligence)
            StatItem(label: "CRE", value: stats.creativity)
            StatItem(label: "CHA", value: stats.charisma)
            StatItem(label: "STA", value: stats.stamina)
            StatItem(label: "TEC", value: stats.tech)
        }
    }
}

struct StatItem: View {
    let label: String
    let value: Int
    
    var body: some View {
        VStack {
            Text(label).font(.caption).bold().foregroundColor(.gray)
            ZStack {
                Circle()
                    .stroke(Color.gray.opacity(0.3), lineWidth: 4)
                Circle()
                    .trim(from: 0, to: CGFloat(value) / 100.0)
                    .stroke(Color.purple, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(value)")
                    .font(.caption2)
                    .foregroundColor(.white)
            }
            .frame(width: 40, height: 40)
        }
        .frame(maxWidth: .infinity)
    }
}

struct SimulationCard: View {
    let title: String
    let difficulty: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading) {
            Text(title)
                .font(.headline)
                .foregroundColor(.white)
                .multilineTextAlignment(.leading)
            Spacer()
            HStack {
                Text(difficulty)
                    .font(.caption)
                    .padding(6)
                    .background(Color.black.opacity(0.4))
                    .cornerRadius(4)
                    .foregroundColor(.white)
                Spacer()
                Image(systemName: "play.circle.fill")
                    .foregroundColor(.white)
            }
        }
        .padding()
        .frame(width: 160, height: 160)
        .background(color.opacity(0.8))
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.white.opacity(0.2), lineWidth: 1))
    }
}

struct MentorCard: View {
    let title: String
    let icon: String
    let description: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .font(.largeTitle)
                .foregroundColor(.purple)
            
            VStack(alignment: .leading) {
                Text(title)
                    .font(.headline)
                    .foregroundColor(.white)
                Text(description)
                    .font(.caption)
                    .foregroundColor(.gray)
            }
            Spacer()
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(Color.white.opacity(0.1))
        .cornerRadius(12)
    }
}
