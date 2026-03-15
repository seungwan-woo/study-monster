/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Gamepad2, 
  Settings, 
  MessageCircle, 
  Send, 
  Sparkles, 
  RotateCcw,
  Plus,
  Minus,
  X,
  ChevronRight,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type GameState = 'playing' | 'won' | 'lost';

interface Message {
  role: 'user' | 'model';
  text: string;
}

// --- Constants ---
const INITIAL_POSITION = 50; // 0 is monster wins, 100 is boy wins
const MONSTER_PUSH_SPEED = 0.3; // Position units per second
const BOY_PUSH_STRENGTH = 4; // Position units per click
const ULTIMATE_STRENGTH = 12; // Position units for special move
const TICK_INTERVAL = 100; // ms

const FUNNY_PHRASES = [
  "공부는 껌이지! (근데 좀 딱딱한 껌...)",
  "몬스터야, 너 구구단은 외우니?",
  "이게 바로 '공부의 정석' 펀치!",
  "문제 풀고 너를 종이비행기로 만들어주마!",
  "내 머릿속엔 계산기만 들어있다!",
  "나의 공부 파워를 받아라!",
  "오답 노트보다 무서운 나의 공격!",
  "1+1은 귀요미가 아니라 2다!",
  "공부하면 키가 큰대요 (아마도?)",
  "몬스터 퇴치! 다음은 영어 몬스터인가...",
  "내 연필은 칼보다 강하다!",
  "지우개로 너의 존재를 지워주마!",
  "교과서 펴는 소리에 놀랐지?",
  "숙제 끝! 이제 네가 끝날 차례다!",
  "나의 집중력은 우주 최강이다!",
  "몬스터야, 너도 학교 갈래?",
  "이 문제는 0.1초 컷!",
  "공부 몬스터? 난 공부 마스터다!",
  "내 뇌세포들이 춤을 추고 있어!",
  "받아라! 피타고라스의 정리 어택!",
  "공부 안 하면 나중에 후회한다구! (진지)",
  "내 엉덩이는 의자에 붙어있다! 무적 모드!",
  "졸음? 그게 뭐야? 먹는 거야?",
  "나의 펜 끝에서 불꽃이 튄다!",
  "전교 1등의 기운을 모아 모아!",
  "몬스터야, 너도 내 오답노트 정리 좀 도와줄래?",
  "이것이 바로 '열공'의 힘이다!",
  "공부 몬스터, 너의 약점은 바로 '교과서'지!",
  "나의 집중력은 다이아몬드보다 단단해!",
  "문제 하나 풀 때마다 너는 한 걸음 뒤로!"
];

const MONSTER_FUNNY_PHRASES = [
  "글씨가 지렁이 기어가는 것 같아!",
  "딴짓하면 내가 더 가까이 간다!",
  "틀렸지? 내가 한 칸 전진!",
  "집중 안 하면 엉덩이 깨문다!",
  "공부 몬스터는 배가 고프다!",
  "졸음이 오나? 내가 깨워줄게!",
  "낙서하지 말고 문제 풀어!",
  "내가 이기면 오늘 간식은 내 거!",
  "멍하니 있으면 내가 밀어버린다!",
  "으르렁! 공부가 세상에서 제일 싫지?",
  "유튜브 보고 싶지? 내가 다 안다!",
  "게임 한 판만 할까? 꼬시는 중...",
  "연필 굴리기 금지! 내가 굴려줄까?",
  "천장 보지 마! 내가 거기 있나?",
  "하품 한 번에 10cm 전진!",
  "너의 집중력은 이미 바닥이다!",
  "공부 몬스터는 포기를 모른다!",
  "아직도 1번 문제니? 한심하군!",
  "내일 하면 안 될까? (악마의 속삭임)",
  "공부 몬스터의 저주! 졸음 폭탄!",
  "에잇, 공부가 그렇게 재밌냐? 흥!",
  "너, 방금 스마트폰 만지려던 거 다 봤다!",
  "코 파지 말고 문제나 풀어!",
  "내가 이기면 오늘 잠은 다 잤다!",
  "공부 몬스터의 필살기! '기억 상실'!",
  "너의 뇌는 지금 휴가 중인가 보군!",
  "공부? 그건 맛있는 건가요? 우적우적!",
  "내 눈을 봐, 넌 이미 졸리고 있다...",
  "공부 몬스터는 너의 '귀차니즘'을 먹고 자란다!",
  "숙제는 내일의 너에게 맡기지 그래?"
];

// --- Components ---

export default function App() {
  const [position, setPosition] = useState(INITIAL_POSITION);
  const [gameState, setGameState] = useState<GameState>('playing');
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [boyImage, setBoyImage] = useState<string | null>(null);
  const [monsterImage, setMonsterImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [phraseTimer, setPhraseTimer] = useState<NodeJS.Timeout | null>(null);
  const [monsterPhrase, setMonsterPhrase] = useState('');
  const [monsterPhraseTimer, setMonsterPhraseTimer] = useState<NodeJS.Timeout | null>(null);
  const [boyConsecutive, setBoyConsecutive] = useState(0);
  const [monsterConsecutive, setMonsterConsecutive] = useState(0);
  const [isUltimate, setIsUltimate] = useState<'boy' | 'monster' | null>(null);
  const [boyHit, setBoyHit] = useState(false);
  const [monsterHit, setMonsterHit] = useState(false);

  // Game Loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      setPosition(prev => {
        const next = prev - (MONSTER_PUSH_SPEED * (TICK_INTERVAL / 1000));
        if (next <= 0) {
          setGameState('lost');
          return 0;
        }
        return next;
      });
    }, TICK_INTERVAL);

    return () => clearInterval(interval);
  }, [gameState]);

  const handlePush = () => {
    if (gameState !== 'playing') return;
    
    // Consecutive hits logic
    const newConsecutive = boyConsecutive + 1;
    setBoyConsecutive(newConsecutive);
    setMonsterConsecutive(0);

    let strength = BOY_PUSH_STRENGTH;
    let phrase = FUNNY_PHRASES[Math.floor(Math.random() * FUNNY_PHRASES.length)];

    if (newConsecutive >= 5) {
      strength = ULTIMATE_STRENGTH;
      setIsUltimate('boy');
      setTimeout(() => setIsUltimate(null), 1000);
      setBoyConsecutive(0);
    }

    // Show funny phrase
    if (phraseTimer) clearTimeout(phraseTimer);
    setCurrentPhrase(phrase);
    const timer = setTimeout(() => setCurrentPhrase(''), 1500);
    setPhraseTimer(timer);

    // Trigger monster hit animation
    setMonsterHit(true);
    setTimeout(() => setMonsterHit(false), 300);

    setPosition(prev => {
      const next = prev + strength;
      if (next >= 100) {
        setGameState('won');
        return 100;
      }
      return next;
    });
  };

  const handleMonsterPush = () => {
    if (gameState !== 'playing') return;

    // Consecutive hits logic
    const newConsecutive = monsterConsecutive + 1;
    setMonsterConsecutive(newConsecutive);
    setBoyConsecutive(0);

    let strength = BOY_PUSH_STRENGTH;
    let phrase = MONSTER_FUNNY_PHRASES[Math.floor(Math.random() * MONSTER_FUNNY_PHRASES.length)];

    if (newConsecutive >= 5) {
      strength = ULTIMATE_STRENGTH;
      setIsUltimate('monster');
      setTimeout(() => setIsUltimate(null), 1000);
      setMonsterConsecutive(0);
    }

    // Show monster phrase
    if (monsterPhraseTimer) clearTimeout(monsterPhraseTimer);
    setMonsterPhrase(phrase);
    const timer = setTimeout(() => setMonsterPhrase(''), 1500);
    setMonsterPhraseTimer(timer);

    // Trigger boy hit animation
    setBoyHit(true);
    setTimeout(() => setBoyHit(false), 300);

    setPosition(prev => {
      const next = prev - strength;
      if (next <= 0) {
        setGameState('lost');
        return 0;
      }
      return next;
    });
  };

  const resetGame = () => {
    setPosition(INITIAL_POSITION);
    setGameState('playing');
    setBoyConsecutive(0);
    setMonsterConsecutive(0);
    setIsUltimate(null);
    setBoyHit(false);
    setMonsterHit(false);
  };

  // API Key Check
  useEffect(() => {
    return () => {
      if (phraseTimer) clearTimeout(phraseTimer);
      if (monsterPhraseTimer) clearTimeout(monsterPhraseTimer);
    };
  }, [phraseTimer, monsterPhraseTimer]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setApiKeySelected(true);
    }
  };

  return (
    <div className="relative h-screen w-full bg-sky-50 font-game overflow-hidden flex flex-col">
      {/* Header */}
      <header className="p-4 flex justify-between items-center bg-white/50 backdrop-blur-sm border-b border-sky-100 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-sky-500 p-2 rounded-lg text-white">
            <Gamepad2 size={24} />
          </div>
          <h1 className="text-2xl font-bold text-sky-900">공부 몬스터 퇴치!</h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Push Button - Kirby First */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePush}
            disabled={gameState !== 'playing'}
            className={cn(
              "px-6 py-3 rounded-2xl text-xl font-bold shadow-lg transition-all border-b-4 active:border-b-0 active:translate-y-1 relative",
              gameState === 'playing' 
                ? "bg-sky-500 text-white border-sky-700 hover:bg-sky-400" 
                : "bg-stone-300 text-stone-500 border-stone-400 cursor-not-allowed"
            )}
          >
            문제 풀었다!
            {boyConsecutive > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-400 text-sky-900 text-xs px-2 py-1 rounded-full border border-white animate-bounce">
                {boyConsecutive}콤보!
              </span>
            )}
          </motion.button>

          {/* Monster Attack Button - Monster Second */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleMonsterPush}
            disabled={gameState !== 'playing'}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-all border-b-4 active:border-b-0 active:translate-y-1 relative",
              gameState === 'playing' 
                ? "bg-red-500 text-white border-red-700 hover:bg-red-400" 
                : "bg-stone-300 text-stone-500 border-stone-400 cursor-not-allowed"
            )}
            title="틀리거나 딴짓할 때 누르세요!"
          >
            몬스터 공격!
            {monsterConsecutive > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full border border-white animate-bounce">
                {monsterConsecutive}콤보!
              </span>
            )}
          </motion.button>

          <div className="flex gap-2">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-sky-100 rounded-full transition-colors text-sky-700"
            >
              <Settings size={24} />
            </button>
            <button 
              onClick={() => setShowChat(!showChat)}
              className="p-2 hover:bg-sky-100 rounded-full transition-colors text-sky-700"
            >
              <MessageCircle size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Game Area */}
      <main className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-300 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-48 h-48 bg-sky-300 rounded-full blur-3xl" />
        </div>

        {/* The Battleground */}
        <div className="w-full max-w-4xl h-96 relative flex items-center">
          {/* Progress Bar (The Ground) */}
          <div className="absolute bottom-0 left-0 w-full h-4 bg-stone-200 rounded-full overflow-hidden border-2 border-stone-300">
            <motion.div 
              className="h-full bg-sky-400"
              animate={{ width: `${position}%` }}
              transition={{ type: 'spring', stiffness: 50 }}
            />
          </div>

          {/* Boy Character */}
          <motion.div 
            className="absolute z-20"
            animate={{ 
              left: `calc(${position}% - 120px)`,
              x: boyHit ? [0, -10, 10, -10, 0] : 0,
              rotate: boyHit ? [0, -5, 5, -5, 0] : 0,
              scale: boyHit ? [1, 1.1, 0.9, 1] : 1
            }}
            transition={{ 
              left: { type: 'spring', stiffness: 50, damping: 15 },
              x: { duration: 0.3 },
              rotate: { duration: 0.3 },
              scale: { duration: 0.3 }
            }}
          >
            <div className="relative group">
              {/* Humorous Bubble */}
              <AnimatePresence>
                {currentPhrase && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: -40, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-2xl shadow-xl border-2 border-sky-200 text-sky-900 font-bold whitespace-nowrap z-30"
                  >
                    {currentPhrase}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-2 border-b-2 border-sky-200 rotate-45" />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="w-48 h-64 flex items-center justify-center">
                {boyImage ? (
                  <img 
                    src={boyImage} 
                    alt="Boy" 
                    className="max-w-full max-h-full object-contain drop-shadow-xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <DefaultBoy />
                )}
              </div>
              {/* Push Force Effect */}
              <AnimatePresence>
                {gameState === 'playing' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ 
                      opacity: isUltimate === 'boy' ? 0.8 : 0.3, 
                      scale: isUltimate === 'boy' ? 2 : 1 
                    }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-32 bg-sky-400 blur-xl rounded-full",
                      isUltimate === 'boy' && "bg-yellow-400 w-16 h-48"
                    )}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Monster Character */}
          <motion.div 
            className="absolute z-20"
            animate={{ 
              left: `calc(${position}% + 20px)`,
              x: monsterHit ? [0, 10, -10, 10, 0] : 0,
              rotate: monsterHit ? [0, 5, -5, 5, 0] : 0,
              scale: monsterHit ? [1, 1.1, 0.9, 1] : 1
            }}
            transition={{ 
              left: { type: 'spring', stiffness: 50, damping: 15 },
              x: { duration: 0.3 },
              rotate: { duration: 0.3 },
              scale: { duration: 0.3 }
            }}
          >
            <div className="relative group">
              {/* Monster Humorous Bubble */}
              <AnimatePresence>
                {monsterPhrase && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: -40, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={cn(
                      "absolute -top-12 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-2xl shadow-xl border-2 border-red-200 text-red-900 font-bold whitespace-nowrap z-30",
                      isUltimate === 'monster' && "border-red-600 bg-red-50 text-red-700 scale-110"
                    )}
                  >
                    {monsterPhrase}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-2 border-b-2 border-red-200 rotate-45" />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="w-48 h-64 flex items-center justify-center">
                {monsterImage ? (
                  <img 
                    src={monsterImage} 
                    alt="Monster" 
                    className="max-w-full max-h-full object-contain drop-shadow-xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <DefaultMonster />
                )}
              </div>
              {/* Push Force Effect */}
              <AnimatePresence>
                {gameState === 'playing' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ 
                      opacity: isUltimate === 'monster' ? 0.8 : 0.3, 
                      scale: isUltimate === 'monster' ? 2 : 1 
                    }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-32 bg-red-400 blur-xl rounded-full",
                      isUltimate === 'monster' && "bg-red-600 w-16 h-48"
                    )}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Controls - Removed the big button from here */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-30">
          <p className="text-sky-900/60 text-lg bg-white/50 px-4 py-2 rounded-full backdrop-blur-sm">
            {gameState === 'playing' ? "공부하고 상단 버튼을 터치하세요!" : "게임이 끝났어요!"}
          </p>
        </div>
      </main>

      {/* Win/Loss Overlays */}
      <AnimatePresence>
        {gameState !== 'playing' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-sky-900/40 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border-4 border-white"
            >
              {gameState === 'won' ? (
                <>
                  <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6 text-yellow-500">
                    <Trophy size={48} />
                  </div>
                  <h2 className="text-4xl font-bold text-sky-900 mb-4">승리!</h2>
                  <p className="text-xl text-sky-700 mb-8">몬스터를 완전히 밀어냈어요! 정말 대단해요!</p>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
                    <RotateCcw size={48} />
                  </div>
                  <h2 className="text-4xl font-bold text-red-900 mb-4">앗!</h2>
                  <p className="text-xl text-red-700 mb-8">몬스터가 너무 세졌어요. 다시 도전해볼까요?</p>
                </>
              )}
              <button 
                onClick={resetGame}
                className="w-full py-4 bg-sky-500 text-white rounded-2xl text-2xl font-bold hover:bg-sky-400 transition-colors shadow-lg"
              >
                다시 시작하기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Chat */}
      <AnimatePresence>
        {showChat && (
          <ChatPanel 
            onClose={() => setShowChat(false)} 
          />
        )}
      </AnimatePresence>

      {/* Settings / Customizer */}
      <AnimatePresence>
        {showSettings && (
          <SettingsPanel 
            onClose={() => setShowSettings(false)}
            onGenerateBoy={(img) => setBoyImage(img)}
            onGenerateMonster={(img) => setMonsterImage(img)}
            apiKeySelected={apiKeySelected}
            onSelectKey={handleSelectKey}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function DefaultBoy() {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <div className="w-32 h-32 bg-pink-300 rounded-full border-4 border-pink-400 relative shadow-inner">
        {/* Kirby Eyes */}
        <div className="absolute top-1/3 left-1/4 w-3 h-8 bg-black rounded-full" />
        <div className="absolute top-1/3 right-1/4 w-3 h-8 bg-black rounded-full" />
        {/* Kirby Cheeks */}
        <div className="absolute top-1/2 left-4 w-6 h-3 bg-pink-400 rounded-full opacity-60" />
        <div className="absolute top-1/2 right-4 w-6 h-3 bg-pink-400 rounded-full opacity-60" />
        {/* Glasses */}
        <div className="absolute top-1/3 -translate-y-1/2 left-2 right-2 flex justify-between z-10">
          <div className="w-12 h-12 border-4 border-stone-800 rounded-full bg-white/30" />
          <div className="w-12 h-12 border-4 border-stone-800 rounded-full bg-white/30" />
        </div>
        <div className="absolute top-1/3 -translate-y-1/2 left-1/2 -translate-x-1/2 w-4 h-1 bg-stone-800 z-10" />
      </div>
      <p className="mt-4 text-pink-900 font-bold text-xl bg-white/80 px-4 py-1 rounded-full">나 (커비)</p>
    </div>
  );
}

function DefaultMonster() {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <div className="w-32 h-32 bg-stone-300 border-4 border-stone-400 relative flex flex-col items-center justify-center">
        {/* Minecraft Wolf Face */}
        <div className="w-24 h-16 bg-stone-200 border-2 border-stone-400 relative">
          <div className="absolute top-2 left-4 w-3 h-3 bg-black" />
          <div className="absolute top-2 right-4 w-3 h-3 bg-black" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-4 bg-stone-800" />
        </div>
        {/* Ears */}
        <div className="absolute -top-4 left-4 w-6 h-6 bg-stone-300 border-2 border-stone-400" />
        <div className="absolute -top-4 right-4 w-6 h-6 bg-stone-300 border-2 border-stone-400" />
      </div>
      <p className="mt-4 text-stone-900 font-bold text-xl bg-white/80 px-4 py-1 rounded-full">공부 몬스터</p>
    </div>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: '안녕! 오늘 공부 힘내자! 모르는 게 있으면 물어봐.' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user' as const, text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [...messages, userMsg].map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction: "당신은 초등학교 2학년 아이를 응원하는 친절한 공부 멘토입니다. 아이가 공부하는 것을 격려하고, 궁금한 점에 답해주세요. 말투는 아주 다정하고 귀엽게 해주세요."
        }
      });
      
      setMessages(prev => [...prev, { role: 'model', text: response.text || '미안해, 다시 말해줄래?' }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: '오류가 발생했어. 나중에 다시 시도해줘!' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-40 flex flex-col border-l border-sky-100"
    >
      <div className="p-4 border-b border-sky-100 flex justify-between items-center bg-sky-50">
        <h3 className="text-xl font-bold text-sky-900 flex items-center gap-2">
          <Sparkles className="text-sky-500" size={20} />
          응원 챗봇
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-sky-200 rounded-full">
          <X size={24} />
        </button>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-sky-50/30">
        {messages.map((m, i) => (
          <div key={i} className={cn(
            "flex flex-col max-w-[85%]",
            m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
          )}>
            <div className={cn(
              "p-3 rounded-2xl text-lg",
              m.role === 'user' 
                ? "bg-sky-500 text-white rounded-tr-none" 
                : "bg-white text-sky-900 shadow-sm border border-sky-100 rounded-tl-none"
            )}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-1 p-2">
            <div className="w-2 h-2 bg-sky-300 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-sky-300 rounded-full animate-bounce delay-75" />
            <div className="w-2 h-2 bg-sky-300 rounded-full animate-bounce delay-150" />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-sky-100 bg-white">
        <div className="flex gap-2">
          <input 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="궁금한 걸 물어봐!"
            className="flex-1 p-3 rounded-xl border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-lg"
          />
          <button 
            onClick={handleSend}
            className="p-3 bg-sky-500 text-white rounded-xl hover:bg-sky-400 transition-colors"
          >
            <Send size={24} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SettingsPanel({ 
  onClose, 
  onGenerateBoy, 
  onGenerateMonster,
  apiKeySelected,
  onSelectKey
}: { 
  onClose: () => void;
  onGenerateBoy: (img: string) => void;
  onGenerateMonster: (img: string) => void;
  apiKeySelected: boolean;
  onSelectKey: () => void;
}) {
  const [isGenerating, setIsGenerating] = useState<'boy' | 'monster' | null>(null);
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');

  const generateImage = async (type: 'boy' | 'monster') => {
    if (!apiKeySelected) {
      onSelectKey();
      return;
    }

    setIsGenerating(type);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = type === 'boy' 
        ? "Kirby character from Nintendo, cute pink round creature with round glasses, 3D render, white background, high quality, vibrant colors"
        : "Minecraft Wolf, blocky pixelated style, 3D render, white background, high quality, authentic minecraft aesthetic";

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: imageSize
          }
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          if (type === 'boy') onGenerateBoy(imageUrl);
          else onGenerateMonster(imageUrl);
        }
      }
    } catch (error) {
      console.error(error);
      alert('이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-md p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl border-4 border-white overflow-y-auto max-h-[90vh]"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-stone-900">캐릭터 꾸미기</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full">
            <X size={28} />
          </button>
        </div>

        {!apiKeySelected ? (
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl mb-8">
            <h3 className="text-xl font-bold text-amber-900 mb-2">API 키가 필요해요!</h3>
            <p className="text-amber-800 mb-4">캐릭터를 AI로 생성하려면 유료 Gemini API 키를 선택해야 합니다.</p>
            <button 
              onClick={onSelectKey}
              className="px-6 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-400 transition-colors"
            >
              API 키 선택하기
            </button>
            <p className="mt-2 text-sm text-amber-700">
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline">결제 문서 확인하기</a>
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Size Selector */}
            <div className="space-y-3">
              <label className="text-lg font-bold text-stone-700">이미지 크기</label>
              <div className="flex gap-2">
                {(['1K', '2K', '4K'] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => setImageSize(size)}
                    className={cn(
                      "flex-1 py-2 rounded-xl font-bold border-2 transition-all",
                      imageSize === size 
                        ? "bg-sky-500 text-white border-sky-500" 
                        : "bg-white text-stone-500 border-stone-200 hover:border-sky-200"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Boy Customizer */}
              <div className="p-6 bg-sky-50 rounded-2xl border-2 border-sky-100 flex flex-col items-center">
                <div className="w-32 h-32 bg-white rounded-2xl mb-4 flex items-center justify-center border-2 border-sky-200 overflow-hidden">
                  <ImageIcon size={48} className="text-sky-200" />
                </div>
                <h3 className="text-xl font-bold text-sky-900 mb-4">나 (소년)</h3>
                <button 
                  onClick={() => generateImage('boy')}
                  disabled={isGenerating !== null}
                  className="w-full py-3 bg-sky-500 text-white rounded-xl font-bold hover:bg-sky-400 disabled:bg-sky-300 flex items-center justify-center gap-2"
                >
                  {isGenerating === 'boy' ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                  AI로 생성하기
                </button>
              </div>

              {/* Monster Customizer */}
              <div className="p-6 bg-red-50 rounded-2xl border-2 border-red-100 flex flex-col items-center">
                <div className="w-32 h-32 bg-white rounded-2xl mb-4 flex items-center justify-center border-2 border-red-200 overflow-hidden">
                  <ImageIcon size={48} className="text-red-200" />
                </div>
                <h3 className="text-xl font-bold text-red-900 mb-4">몬스터</h3>
                <button 
                  onClick={() => generateImage('monster')}
                  disabled={isGenerating !== null}
                  className="w-full py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-400 disabled:bg-red-300 flex items-center justify-center gap-2"
                >
                  {isGenerating === 'monster' ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                  AI로 생성하기
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-stone-100">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-stone-900 text-white rounded-2xl text-xl font-bold hover:bg-stone-800 transition-colors"
          >
            완료
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
