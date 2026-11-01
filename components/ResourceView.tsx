
import React, { useEffect, useState } from 'react';
import { JobOption, Resource, Language } from '../types';
import { generateSkillTree } from '../services/apiService';
import { Button } from './Button';
import { Book, Video, Target, Sword, ExternalLink, Github } from 'lucide-react';

interface ResourceViewProps {
  job: JobOption;
  onStartTutor: (resources: Resource[]) => void;
  language: Language;
}

export const ResourceView: React.FC<ResourceViewProps> = ({ job, onStartTutor, language }) => {
  const isZh = language === 'zh';
  const t = {
    loadingTitle: isZh ? "正在生成技能树..." : "Generating Skill Tree...",
    loadingDesc: isZh ? `AI 正在为您拆解 ${job.title} 的核心能力节点` : `AI is breaking down core skills for ${job.title}`,
    title: isZh ? "技能树" : "Skill Tree",
    subtitle: isZh ? "点亮以下节点，您将从菜鸟进化为职业玩家。" : "Unlock these nodes to evolve from Noob to Pro.",
    startTutor: isZh ? "准备好练级了吗？" : "Ready to level up?",
    activateTutor: isZh ? "激活 AI 导师" : "Activate AI Tutor",
    tutorDesc: isZh ? "激活专属 AI 导师，开始苏格拉底式教学。" : "Activate your mentor for Socratic learning.",
    error: isZh ? "未能生成技能树，请重试。" : "Unable to generate the skill tree. Please retry.",
    retry: isZh ? "重试" : "Retry"
  };

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setResources([]);
    const fetchResources = async () => {
      try {
        const data = await generateSkillTree(job.title, language);
        if (!active) return;
        if (!Array.isArray(data) || data.length === 0) {
          setError(true);
          return;
        }
        setResources(data);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchResources();
    return () => { active = false; };
  }, [job.title, language, retryCount]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'Video': return <Video className="w-5 h-5 text-red-400" />;
      case 'Book': return <Book className="w-5 h-5 text-blue-400" />;
      case 'GitHub': return <Github className="w-5 h-5 text-white" />;
      case 'Mission': return <Target className="w-5 h-5 text-yellow-400" />;
      default: return <Book className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl text-white font-bold tracking-tight">{t.loadingTitle}</h2>
        <p className="text-slate-400 mt-2">{t.loadingDesc}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto text-center">
        <p role="alert">{t.error}</p>
        <Button onClick={() => setRetryCount(count => count + 1)}>{t.retry}</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-black text-white mb-2 uppercase italic">{t.title}</h2>
        <p className="text-slate-400">{t.subtitle}</p>
      </div>

      {/* Tree Visualizer */}
      <div className="relative space-y-8 before:absolute before:left-6 md:before:left-1/2 before:top-0 before:h-full before:w-0.5 before:bg-slate-700 before:-translate-x-1/2 before:z-0">
        {resources.map((res, idx) => {
          const isLeft = idx % 2 === 0;
          return (
            <div key={idx} className={`relative z-10 flex items-center gap-8 ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'}`}>

              {/* Node Connector Dot */}
              <div className="absolute left-6 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-900 border-2 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>

              {/* Card */}
              <div className={`flex-1 ml-12 md:ml-0 ${isLeft ? 'md:text-right' : 'md:text-left'}`}>
                <div className={`bg-slate-800/80 backdrop-blur border border-slate-700 p-6 rounded-2xl hover:border-indigo-500 transition-all group inline-block w-full md:w-[90%] relative overflow-hidden`}>
                  <div className={`absolute top-0 w-1 h-full bg-indigo-500 ${isLeft ? 'right-0 md:right-0 md:left-auto' : 'left-0'} opacity-0 group-hover:opacity-100 transition-opacity`}></div>

                  <div className={`flex items-center gap-4 mb-2 ${isLeft ? 'md:flex-row-reverse' : 'flex-row'}`}>
                    <span className="p-2 bg-black/40 rounded-lg border border-slate-600 group-hover:border-indigo-500/50 transition-colors">
                      {getIcon(res.type)}
                    </span>
                    <div className={`flex-1 ${isLeft ? 'text-right' : 'text-left'}`}>
                      <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">{res.title}</h3>
                    </div>
                  </div>

                  <p className="text-slate-400 text-sm mb-3 leading-relaxed">{res.description}</p>

                  <div className={`flex items-center gap-4 text-xs font-mono text-indigo-400/80 ${isLeft ? 'md:justify-end' : 'justify-start'}`}>
                    <span className="px-2 py-1 bg-indigo-500/10 rounded border border-indigo-500/20">+{res.xp} XP</span>
                    <span className="text-slate-600 uppercase">| {res.type}</span>
                    {res.url && (
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline ml-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {isZh ? '访问链接' : 'Open Link'}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Empty Spacer for alternating grid */}
              <div className="hidden md:block flex-1"></div>
            </div>
          );
        })}
      </div>

      {/* Action Bar */}
      <div className="mt-16 bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
            <Sword className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">{t.startTutor}</h3>
            <p className="text-slate-400 text-sm">{t.tutorDesc}</p>
          </div>
        </div>
        <Button
          onClick={() => onStartTutor(resources)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 text-lg font-bold shadow-lg shadow-indigo-500/30 border-none w-full md:w-auto"
        >
          {t.activateTutor}
        </Button>
      </div>
    </div>
  );
};
