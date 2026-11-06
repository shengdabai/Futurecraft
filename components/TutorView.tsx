
import React, { useState, useRef, useEffect } from 'react';
import { JobOption, Resource, ChatMessage, Language } from '../types';
import { getTutorResponse } from '../services/apiService';
import { Send, User, Bot, MoreHorizontal, Sword, Skull } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface TutorViewProps {
  job: JobOption;
  resources: Resource[];
  language: Language;
}

export const TutorView: React.FC<TutorViewProps> = ({ job, resources, language }) => {
  const isZh = language === 'zh';
  const t = {
    intro: isZh
      ? `队友你好！我是你的 ${job.title} 专属向导。技能树已加载完毕，我们从哪里开始练级？建议先聊聊基础概念，或者你可以随时向我提问。`
      : `Greetings Teammate! I am your guide for ${job.title}. Skill tree loaded. Where should we start grinding? We can discuss basics or you can ask me anything.`,
    bossIntro: isZh
      ? `🚨 **WARNING: BOSS BATTLE INITIATED** 🚨\n\n我是你的面试主考官。现在开始，我不会再对你客气了。准备好接受高压测试了吗？请简短自我介绍。`
      : `🚨 **WARNING: BOSS BATTLE INITIATED** 🚨\n\nI am your Interviewer Boss. I will show no mercy. Are you ready for a stress test? Introduce yourself briefly.`,
    bossExit: isZh
      ? `已退出 Boss 战模式。呼...刚才太紧张了。我们回到轻松的学习模式吧，有什么不懂的可以问我。`
      : `Boss Battle Mode disengaged. Phew... that was intense. Let's go back to learning mode.`,
    error: isZh ? "连接波动...请重试。" : "Connection unstable... please retry.",
    bossTitle: isZh ? 'FINAL BOSS: 面试官' : 'FINAL BOSS: INTERVIEWER',
    tutorTitle: isZh ? `AI 导师: ${job.title}` : `AI Tutor: ${job.title}`,
    hp: isZh ? 'HP: ???????' : 'HP: ???????',
    system: 'System Online • Socratic Mode',
    leaveBoss: isZh ? '逃离 Boss 战' : 'Escape Boss Battle',
    enterBoss: isZh ? '挑战 Boss 战 (面试)' : 'Boss Battle (Interview)',
    bossInput: isZh ? "小心回答，每一次失误都会扣分..." : "Answer carefully, mistakes will cost HP...",
    tutorInput: isZh ? "输入问题，或要求进行专项训练..." : "Ask a question, or request special training..."
  };

  const [isBossMode, setIsBossMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: t.intro }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Switch mode handler
  const toggleBossMode = () => {
    const newMode = !isBossMode;
    setIsBossMode(newMode);
    setMessages(prev => [
      ...prev,
      {
        role: 'model',
        text: newMode ? t.bossIntro : t.bossExit,
        isBoss: newMode
      }
    ]);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setLoading(true);

    const newHistory = [...messages, { role: 'user', text: userMsg } as ChatMessage];
    setMessages(newHistory);

    try {
      const responseText = await getTutorResponse(newHistory, userMsg, job, isBossMode, language);
      if (responseText) {
        setMessages(prev => [...prev, { role: 'model', text: responseText, isBoss: isBossMode }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: t.error }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`h-[calc(100vh-140px)] flex flex-col rounded-2xl overflow-hidden border shadow-2xl transition-all duration-500 ${isBossMode ? 'bg-red-950/30 border-red-600/50 shadow-red-900/20' : 'bg-slate-900 border-slate-700'}`}>

      {/* Header */}
      <div className={`p-4 flex items-center justify-between gap-3 border-b transition-colors duration-500 ${isBossMode ? 'bg-red-900/50 border-red-600/30' : 'bg-slate-800 border-slate-700'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-lg transition-all ${isBossMode ? 'bg-red-600 animate-pulse' : 'bg-indigo-600'}`}>
            {isBossMode ? <Skull className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-white font-bold flex items-center gap-2">
              {isBossMode ? t.bossTitle : t.tutorTitle}
            </h3>
            <p className={`text-xs font-mono ${isBossMode ? 'text-red-300' : 'text-green-400'}`}>
              {isBossMode ? t.hp : t.system}
            </p>
          </div>
        </div>

        <button
          onClick={toggleBossMode}
          className={`flex items-center gap-2 px-4 py-2 shrink-0 whitespace-nowrap rounded-lg text-sm font-bold border transition-all ${isBossMode
              ? 'bg-slate-900 text-slate-300 border-slate-600 hover:bg-slate-800'
              : 'bg-red-600/20 text-red-400 border-red-600/50 hover:bg-red-600/30'
            }`}
        >
          {isBossMode ? t.leaveBoss : t.enterBoss}
          {!isBossMode && <Sword className="w-4 h-4" />}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 relative">
        {isBossMode && (
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent via-red-900/5 to-red-900/20 animate-pulse"></div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 relative z-10 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 border ${msg.role === 'user'
                ? 'bg-slate-800 border-slate-600'
                : msg.isBoss
                  ? 'bg-red-900 border-red-500 text-red-200'
                  : 'bg-indigo-900 border-indigo-500 text-indigo-200'
              }`}>
              {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : msg.isBoss ? <Skull className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-lg ${msg.role === 'user'
                ? 'bg-slate-700 text-white rounded-tr-none'
                : msg.isBoss
                  ? 'bg-red-950/80 text-red-100 border border-red-800 rounded-tl-none'
                  : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
              }`}>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-900/50 border border-indigo-500/50 flex items-center justify-center mt-1">
              <MoreHorizontal className="w-4 h-4 text-indigo-400 animate-pulse" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={`p-4 border-t ${isBossMode ? 'bg-red-950/20 border-red-900/50' : 'bg-slate-800 border-slate-700'}`}>
        <div className="relative flex items-center gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            className={`w-full bg-slate-900 border rounded-xl px-4 py-4 pr-12 text-white focus:ring-2 outline-none transition-all ${isBossMode
                ? 'border-red-900 focus:ring-red-600 placeholder-red-800/50'
                : 'border-slate-600 placeholder-slate-500 focus:ring-indigo-500'
              }`}
            placeholder={isBossMode ? t.bossInput : t.tutorInput}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={`absolute right-2 p-2 rounded-lg disabled:opacity-50 transition-colors ${isBossMode
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
