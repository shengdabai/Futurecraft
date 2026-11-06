
import React, { useState } from 'react';
import { AppPhase, UserProfile, CareerPath, JobOption, Resource, Language } from './types';
import { performSoulScan } from './services/apiService';
import { AssessmentForm } from './components/AssessmentForm';
import { AnalysisView } from './components/AnalysisView';
import { ResourceView } from './components/ResourceView';
import { TutorView } from './components/TutorView';
import { SimulationView } from './components/SimulationView';
import { LifeSimulationView } from './components/LifeSimulationView';
import { Hexagon, ChevronRight, Globe, Video } from 'lucide-react';

const App: React.FC = () => {
  const [phase, setPhase] = useState<AppPhase>(AppPhase.SOUL_SCAN);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<Language>('zh');

  // State Data
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '', major: '', hobbies: [], hiddenTalent: '' });
  const [careers, setCareers] = useState<CareerPath[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobOption | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);

  const handleSoulScanSubmit = async (profile: UserProfile) => {
    setLoading(true);
    try {
      const result = await performSoulScan(profile, language);
      setUserProfile({ ...profile, rpgStats: result.stats, archetype: result.archetype });
      setCareers(result.careers);
      setPhase(AppPhase.MULTIVERSE);
    } catch (e) {
      console.error("Soul Scan failed", e);
      alert(language === 'zh' ? "连接服务器失败，请稍后再试。" : "Server connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJobSelect = (job: JobOption) => {
    setSelectedJob(job);
    setPhase(AppPhase.SIMULATION); // Jump to Game First
  };

  const handleSimulationComplete = () => {
    setPhase(AppPhase.SKILL_TREE);
  };

  const handleStartTutor = (res: Resource[]) => {
    setResources(res);
    setPhase(AppPhase.TUTOR);
  };

  // Render Helper
  const renderPhase = () => {
    switch (phase) {
      case AppPhase.SOUL_SCAN:
        return <AssessmentForm onSubmit={handleSoulScanSubmit} isLoading={loading} language={language} />;

      case AppPhase.MULTIVERSE:
        return <AnalysisView profile={userProfile} careers={careers} onSelectJob={handleJobSelect} language={language} />;

      case AppPhase.SIMULATION:
        if (!selectedJob) return null;
        return <SimulationView job={selectedJob} onComplete={handleSimulationComplete} language={language} />;

      case AppPhase.SKILL_TREE:
        if (!selectedJob) return null;
        return <ResourceView job={selectedJob} onStartTutor={handleStartTutor} language={language} />;

      case AppPhase.TUTOR:
        if (!selectedJob) return null;
        return <TutorView job={selectedJob} resources={resources} language={language} />;

      case AppPhase.LIFE_SIMULATION:
        return <LifeSimulationView language={language} onBack={() => setPhase(AppPhase.SOUL_SCAN)} />;

      default:
        return <div>Unknown Glitch in the Matrix</div>;
    }
  };

  // Breadcrumbs
  const steps = [
    { id: AppPhase.SOUL_SCAN, label: "SOUL_SCAN" },
    { id: AppPhase.MULTIVERSE, label: "MULTIVERSE" },
    { id: AppPhase.SIMULATION, label: "SIMULATION" },
    { id: AppPhase.SKILL_TREE, label: "SKILL_TREE" },
    { id: AppPhase.TUTOR, label: "TUTOR" },
    { id: AppPhase.LIFE_SIMULATION, label: "LIFE_SIM" },
  ];

  return (
    <div className="min-h-screen bg-[#05050a] text-white overflow-x-hidden font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setPhase(AppPhase.SOUL_SCAN)}>
            <div className="bg-gradient-to-br from-cyan-500 to-purple-600 p-1.5 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.5)] group-hover:shadow-[0_0_25px_rgba(168,85,247,0.8)] transition-all">
              <Hexagon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tighter italic">FutureCraft <span className="text-cyan-500 not-italic font-mono text-xs bg-cyan-900/30 px-1 rounded">BETA</span></h1>
          </div>

          <div className="flex items-center gap-6">
            {/* Life Simulation Button */}
            <button
              onClick={() => setPhase(AppPhase.LIFE_SIMULATION)}
              className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                phase === AppPhase.LIFE_SIMULATION
                  ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Video className="w-4 h-4" />
              {language === 'zh' ? '人生模拟' : 'Life Sim'}
            </button>

            {/* Step Indicator */}
            <div className="hidden lg:flex items-center space-x-1">
              {steps.map((step, idx) => {
                const stepIndex = steps.findIndex(s => s.id === step.id);
                const currentIndex = steps.findIndex(s => s.id === phase);
                const isActive = step.id === phase;
                const isPast = stepIndex < currentIndex;

                return (
                  <React.Fragment key={step.id}>
                    <div className={`text-[10px] font-bold px-2 py-1 rounded transition-all uppercase tracking-wider ${isActive ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.8)]' :
                        isPast ? 'text-cyan-400/50' : 'text-slate-700'
                      }`}>
                      {step.label}
                    </div>
                    {idx < steps.length - 1 && (
                      <ChevronRight className={`w-3 h-3 ${isPast ? 'text-cyan-900' : 'text-slate-800'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Language Switch */}
            <button
              onClick={() => setLanguage(l => l === 'zh' ? 'en' : 'zh')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-600 text-xs font-bold hover:bg-slate-700 transition-colors"
            >
              <Globe className="w-3 h-3" />
              {language === 'zh' ? 'CN / EN' : 'EN / CN'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative">
        {/* Ambient Background Effects */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-[40%] left-[50%] w-[20%] h-[20%] bg-blue-600/5 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 animate-in fade-in duration-700">
          {renderPhase()}
        </div>
      </main>
    </div>
  );
};

export default App;
