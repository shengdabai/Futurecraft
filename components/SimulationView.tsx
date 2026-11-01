
import React, { useState, useEffect, useRef } from 'react';
import { JobOption, SimulationStep, SimulationResult, Language } from '../types';
import { generateSimulationScenario, evaluateSimulationChoice } from '../services/apiService';
import { Button } from './Button';
import { Terminal, ShieldAlert, ArrowRight, Trophy } from 'lucide-react';

interface SimulationViewProps {
  job: JobOption;
  onComplete: () => void;
  language: Language;
}

export const SimulationView: React.FC<SimulationViewProps> = ({ job, onComplete, language }) => {
  const isZh = language === 'zh';
  const t = {
    introTitle: "LIFE_SIMULATION_v1.0",
    introDesc1: isZh ? `您即将加载` : `You are about to load`,
    introDesc2: isZh ? `的一日体验副本。` : `Day One simulation.`,
    introDesc3: isZh ? "这是一个低成本试错的机会。如果你在第一天就崩溃了，那最好现在就知道。" : "This is a low-cost trial. If you crash on Day 1, better to know now.",
    start: isZh ? "开始体验" : "Start Simulation",
    missionStart: isZh ? "任务开始：第一天" : "Mission Start: Day 1",
    calculating: isZh ? "正在推演结果..." : "Calculating Outcome...",
    feedback: isZh ? "系统反馈" : "System Feedback",
    replay: isZh ? "重玩副本" : "Replay",
    unlock: isZh ? "解锁技能树" : "Unlock Skill Tree",
    error: isZh ? "请求失败，请重试。" : "Request failed. Please try again."
  };

  const [step, setStep] = useState<'intro' | 'scenario' | 'result'>('intro');
  const [loading, setLoading] = useState(false);
  const [scenarioData, setScenarioData] = useState<SimulationStep | null>(null);
  const [resultData, setResultData] = useState<SimulationResult | null>(null);
  const [error, setError] = useState(false);
  const request = useRef({ id: 0, pending: false });

  useEffect(() => {
    request.current.id++;
    request.current.pending = false;
    setStep('intro');
    setLoading(false);
    setError(false);
    setScenarioData(null);
    setResultData(null);
    return () => {
      request.current.id++;
      request.current.pending = false;
    };
  }, [job.title, language]);

  const startSim = async () => {
    if (request.current.pending) return;
    const requestId = ++request.current.id;
    request.current.pending = true;
    setLoading(true);
    setError(false);
    try {
      const data = await generateSimulationScenario(job.title, language);
      if (requestId !== request.current.id) return;
      setScenarioData(data);
      setStep('scenario');
    } catch {
      if (requestId === request.current.id) setError(true);
    } finally {
      if (requestId === request.current.id) {
        request.current.pending = false;
        setLoading(false);
      }
    }
  };

  const handleChoice = async (choice: string) => {
    if (!scenarioData || request.current.pending) return;
    const requestId = ++request.current.id;
    request.current.pending = true;
    setLoading(true);
    setError(false);
    try {
      const result = await evaluateSimulationChoice(job.title, scenarioData.scenario, choice, language);
      if (requestId !== request.current.id) return;
      setResultData(result);
      setStep('result');
    } catch {
      if (requestId === request.current.id) setError(true);
    } finally {
      if (requestId === request.current.id) {
        request.current.pending = false;
        setLoading(false);
      }
    }
  };

  if (step === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-2xl mx-auto space-y-8">
        <div className="w-24 h-24 bg-purple-900/30 rounded-full flex items-center justify-center border-2 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.4)] animate-pulse">
          <Terminal className="w-10 h-10 text-purple-400" />
        </div>
        <div>
          <h1 className="text-4xl font-black text-white mb-4">{t.introTitle}</h1>
          <p className="text-xl text-slate-300">
            {t.introDesc1} <span className="text-purple-400 font-mono font-bold">[{job.title}]</span> {t.introDesc2}
            <br />
            {t.introDesc3}
          </p>
        </div>
        <Button onClick={startSim} isLoading={loading} className="bg-purple-600 hover:bg-purple-500 px-8 py-4 text-lg border-none">
          {t.start}
        </Button>
        {error && <p role="alert">{t.error}</p>}
      </div>
    );
  }

  if (step === 'scenario' && scenarioData) {
    return (
      <div className="max-w-3xl mx-auto mt-10">
        <div className="bg-black/50 border border-slate-600 rounded-xl p-8 shadow-2xl font-mono relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-green-500 animate-[loading_2s_ease-in-out_infinite]" />
          <div className="flex items-center gap-3 mb-6 text-green-400">
            <Terminal className="w-5 h-5" />
            <span className="uppercase tracking-widest font-bold">{t.missionStart}</span>
          </div>

          <p className="text-xl text-white leading-relaxed mb-10 typing-effect">
            {scenarioData.scenario}
          </p>

          <div className="space-y-4">
            {scenarioData.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleChoice(opt.text)}
                disabled={loading}
                className="w-full text-left p-5 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-purple-900/30 hover:border-purple-500 transition-all group"
              >
                <span className="text-purple-400 font-bold mr-4 group-hover:text-purple-300">[{opt.id}]</span>
                <span className="text-slate-300 group-hover:text-white">{opt.text}</span>
              </button>
            ))}
          </div>
          {loading && <div className="mt-4 text-center text-slate-500 animate-pulse">{t.calculating}</div>}
          {error && <p role="alert">{t.error}</p>}
        </div>
      </div>
    );
  }

  if (step === 'result' && resultData) {
    const isSuccess = resultData.outcome === 'SURVIVED';
    return (
      <div className="max-w-2xl mx-auto mt-10 text-center">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${isSuccess ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {isSuccess ? <Trophy className="w-10 h-10" /> : <ShieldAlert className="w-10 h-10" />}
        </div>

        <h2 className="text-3xl font-bold text-white mb-2">{resultData.outcome}</h2>
        <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 mb-8">
          {resultData.score}<span className="text-2xl align-top opacity-50">/100</span>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl mb-8 text-left">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">{t.feedback}</h3>
          <p className="text-white">{resultData.feedback}</p>
        </div>

        <div className="flex gap-4 justify-center">
          <Button variant="secondary" onClick={() => setStep('intro')}>{t.replay}</Button>
          <Button onClick={onComplete} icon={<ArrowRight className="w-4 h-4" />}>{t.unlock}</Button>
        </div>
      </div>
    );
  }

  return null;
};
