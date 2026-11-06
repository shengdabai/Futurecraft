
import React, { useState, useRef, useEffect } from 'react';
import { CareerPath, JobOption, UserProfile, Language } from '../types';
import { AIAnchor } from './AIAnchor';
import { Button } from './Button';
import { Play, Pause, AlertTriangle, Clock, Hexagon, Map } from 'lucide-react';
import { generateAnchorSpeech, decodeAudioData } from '../services/apiService';

interface AnalysisViewProps {
  profile: UserProfile;
  careers: CareerPath[];
  onSelectJob: (job: JobOption) => void;
  language: Language;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ profile, careers, onSelectJob, language }) => {
  const isZh = language === 'zh';
  const t = {
    mapTitle: isZh ? "多元宇宙地图" : "Multiverse Map",
    live: isZh ? "直播中" : "LIVE",
    standby: isZh ? "待机中" : "STANDBY",
    dayInLife: isZh ? "这一天是怎么过的" : "Day In Life",
    pitfalls: isZh ? "劝退指南" : "Reality Check",
    enterSim: isZh ? "进入人生模拟器 (RPG)" : "Enter Life Simulation (RPG)",
    stats: {
      int: isZh ? "智力" : "INT",
      crt: isZh ? "创造" : "CRT",
      chr: isZh ? "魅力" : "CHR",
      tec: isZh ? "技术" : "TEC"
    }
  };

  const [selectedJob, setSelectedJob] = useState<JobOption | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Audio State
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});
  const [loadingAudioIds, setLoadingAudioIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (careers.length > 0 && careers[0].jobs.length > 0) {
      setSelectedJob(careers[0].jobs[0]);
    }
  }, [careers]);

  useEffect(() => {
    // Attempt to pre-load audio for the selected job if not cached
    if (!selectedJob) return;
    if (audioCache[selectedJob.id] || loadingAudioIds.has(selectedJob.id)) return;

    const jobId = selectedJob.id;

    // Dynamic script based on language
    let script = "";
    if (isZh) {
      script = `
        嘿，未来的${selectedJob.title}！这里是 ${selectedJob.title} 的生活真相。
        如果你选择了这条路，${selectedJob.dayInLife}
        但是，也别忘了坑爹的一面：${selectedJob.pitfalls}
        不过看你的属性，匹配度高达 ${selectedJob.matchScore}分，要不要去“人生模拟器”里试玩一下？
        `;
    } else {
      script = `
        Hey, future ${selectedJob.title}! Here is the truth about being a ${selectedJob.title}.
        If you choose this path, ${selectedJob.dayInLife}
        But don't forget the downside: ${selectedJob.pitfalls}
        Your stats match this by ${selectedJob.matchScore}%. Want to try the Life Simulator?
        `;
    }

    setLoadingAudioIds(prev => new Set(prev).add(jobId));
    generateAnchorSpeech(script).then(base64 => {
      if (base64) setAudioCache(prev => ({ ...prev, [jobId]: base64 }));
      setLoadingAudioIds(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    });
  }, [selectedJob, audioCache, loadingAudioIds, isZh]);

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setIsSpeaking(false);
  };

  const handlePlayExplanation = async () => {
    if (!selectedJob) return;
    if (isSpeaking) {
      stopAudio();
      return;
    }
    const base64Audio = audioCache[selectedJob.id];
    if (!base64Audio) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

      const audioBuffer = await decodeAudioData(base64Audio, audioContextRef.current);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsSpeaking(false);
      source.start(0);
      sourceNodeRef.current = source;
      setIsSpeaking(true);
    } catch (err) {
      console.error(err);
      setIsSpeaking(false);
    }
  };

  const handleJobClick = (job: JobOption) => {
    stopAudio();
    setSelectedJob(job);
  };

  if (!selectedJob) return <div className="text-white">Loading Multiverse...</div>;
  const isAudioLoading = loadingAudioIds.has(selectedJob.id) && !audioCache[selectedJob.id];

  const renderStatBar = (label: string, value: number, color: string) => (
    <div className="flex items-center gap-2 text-xs mb-1">
      <span className="w-16 text-slate-400 font-mono">{label}</span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 text-right text-white">{value}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">

      {/* LEFT: Player Card & Map */}
      <div className="lg:col-span-4 space-y-6">
        {/* Player Card */}
        <div className="bg-slate-900/90 border border-purple-500/30 p-6 rounded-2xl relative overflow-hidden shadow-[0_0_30px_rgba(168,85,247,0.1)]">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-purple-500" />
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white">{profile.name}</h2>
              <p className="text-purple-400 font-mono text-sm uppercase tracking-widest">{profile.archetype || 'Novice'}</p>
            </div>
            <Hexagon className="w-8 h-8 text-cyan-500 opacity-50" />
          </div>

          <div className="space-y-2 mb-4">
            {profile.rpgStats && (
              <>
                {renderStatBar(t.stats.int, profile.rpgStats.intelligence, "bg-blue-500")}
                {renderStatBar(t.stats.crt, profile.rpgStats.creativity, "bg-pink-500")}
                {renderStatBar(t.stats.chr, profile.rpgStats.charisma, "bg-yellow-500")}
                {renderStatBar(t.stats.tec, profile.rpgStats.tech, "bg-cyan-500")}
              </>
            )}
          </div>
        </div>

        {/* Navigation Map */}
        <div className="space-y-4 overflow-y-auto max-h-[50vh] pr-2 custom-scrollbar">
          <h3 className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
            <Map className="w-4 h-4" /> {t.mapTitle}
          </h3>
          {careers.map((cat) => (
            <div key={cat.id} className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">{cat.category}</h4>
              {cat.jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => handleJobClick(job)}
                  className={`w-full text-left p-3 rounded-lg border transition-all duration-200 group relative overflow-hidden ${selectedJob.id === job.id
                      ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-500/20'
                      : 'bg-slate-800/40 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                    }`}
                >
                  <div className="relative z-10 flex justify-between items-center">
                    <span className={`font-bold ${selectedJob.id === job.id ? 'text-white' : 'text-slate-300'}`}>{job.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-black/30 text-white/80 font-mono">{job.matchScore}%</span>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Anchor & Details */}
      <div className="lg:col-span-8 space-y-6">
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-2xl bg-black">
          <AIAnchor isPlaying={isSpeaking} />

          {/* Overlay Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 flex items-end justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold mb-2 uppercase tracking-wider animate-pulse">
                {t.live}: {selectedJob.title}
              </div>
              <h2 className="text-3xl font-bold text-white leading-none">{selectedJob.title}</h2>
            </div>
            <Button
              onClick={handlePlayExplanation}
              className="rounded-full! w-12 h-12 p-0 flex items-center justify-center bg-white text-black hover:bg-cyan-400 border-none"
              isLoading={isAudioLoading}
            >
              {isAudioLoading ? <Clock className="w-5 h-5 animate-spin" /> : isSpeaking ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
            </Button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700 hover:border-cyan-500/30 transition-colors">
            <h3 className="flex items-center gap-2 text-cyan-400 font-bold mb-2 uppercase text-sm">
              <Clock className="w-4 h-4" /> {t.dayInLife}
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">{selectedJob.dayInLife}</p>
          </div>

          <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700 hover:border-red-500/30 transition-colors">
            <h3 className="flex items-center gap-2 text-red-400 font-bold mb-2 uppercase text-sm">
              <AlertTriangle className="w-4 h-4" /> {t.pitfalls}
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">{selectedJob.pitfalls}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => onSelectJob(selectedJob)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-none px-8 py-4 text-lg font-bold shadow-lg shadow-purple-500/25"
            icon={<Play className="w-5 h-5 fill-current" />}
          >
            {t.enterSim}
          </Button>
        </div>
      </div>
    </div>
  );
};
