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

interface MonsterConfig {
  id: string;
  name: string;
  description: string;
  pushSpeed: number; // Passive push speed
  activeStrength: number; // Strength when "Monster Attack" is clicked
  phrases: string[];
  color: string;
  icon: string;
}

interface BoyConfig {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

// --- Constants ---
const INITIAL_POSITION = 50; 
const TICK_INTERVAL = 100; // ms
const BOY_PUSH_STRENGTH = 4;
const ULTIMATE_STRENGTH = 12;

const BOYS: BoyConfig[] = [
  {
    id: 'kirby',
    name: '커비',
    description: '무엇이든 빨아들이는 핑크색 귀요미!',
    color: 'bg-pink-300',
    icon: '💖'
  },
  {
    id: 'shyguy',
    name: '헤이호',
    description: '가면을 쓴 귀여운 악당, 하지만 여기선 내 편!',
    color: 'bg-red-400',
    icon: '🎭'
  },
  {
    id: 'ninjago',
    name: '닌자고 레고',
    description: '스핀짓주 마스터! 레고 닌자입니다.',
    color: 'bg-green-500',
    icon: '🥷'
  },
  {
    id: 'pikmin',
    name: '피크민',
    description: '작지만 강한 생명체, 피크민입니다.',
    color: 'bg-red-600',
    icon: '🌱'
  }
];

const MONSTERS: MonsterConfig[] = [
  {
    id: 'wolf',
    name: '공부 늑대',
    description: '표준적인 몬스터입니다. 꾸준히 밀어붙입니다.',
    pushSpeed: 0.3,
    activeStrength: 4,
    color: 'bg-stone-400',
    icon: '🐺',
    phrases: [
      "글씨가 지렁이 기어가는 것 같아!",
      "딴짓하면 내가 더 가까이 간다!",
      "틀렸지? 내가 한 칸 전진!",
      "집중 안 하면 엉덩이 깨문다!",
      "공부 몬스터는 배가 고프다!",
      "졸음이 오나? 내가 깨워줄게!",
      "낙서하지 말고 문제 풀어!",
      "내가 이기면 오늘 간식은 내 거!"
    ]
  },
  {
    id: 'slime',
    name: '끈적 슬라임',
    description: '느리지만 한 번 공격할 때 아주 묵직합니다.',
    pushSpeed: 0.15,
    activeStrength: 7,
    color: 'bg-emerald-400',
    icon: '🧪',
    phrases: [
      "끈적끈적하게 방해해주마!",
      "내 몸속에 교과서를 가둬버릴 거야!",
      "느릿느릿... 하지만 멈추지 않아!",
      "공부하기 싫지? 나랑 같이 놀자~",
      "네 집중력을 끈적하게 녹여주마!",
      "한 번 잡히면 못 빠져나갈걸?"
    ]
  },
  {
    id: 'dragon',
    name: '졸음 드래곤',
    description: '매우 빠르게 다가오지만, 직접적인 공격력은 약합니다.',
    pushSpeed: 0.6,
    activeStrength: 2,
    color: 'bg-red-500',
    icon: '🐲',
    phrases: [
      "내 뜨거운 졸음 브레스를 받아라!",
      "날아오는 속도를 감당할 수 있겠나?",
      "눈꺼풀이 무거워지는 마법을 걸었다!",
      "하늘 위에서 네 숙제를 다 태워버릴 거야!",
      "졸음의 불꽃이 타오른다!",
      "빨리 포기하고 잠이나 자라구!"
    ]
  },
  {
    id: 'ghost',
    name: '깜빡 유령',
    description: '공격력이 매번 달라지는 종잡을 수 없는 유령입니다.',
    pushSpeed: 0.35,
    activeStrength: 0, // Calculated randomly
    color: 'bg-indigo-300',
    icon: '👻',
    phrases: [
      "방금 배운 거 다 까먹었지? 히히!",
      "머릿속을 하얗게 지워주마!",
      "내가 보였다 안 보였다 할걸?",
      "기억력이 유령처럼 사라진다~",
      "문제 번호가 몇 번이었더라?",
      "공포의 받아쓰기 시험을 보여주마!"
    ]
  }
];

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
  const [selectedBoy, setSelectedBoy] = useState<BoyConfig>(BOYS[0]);
  const [selectedMonster, setSelectedMonster] = useState<MonsterConfig>(MONSTERS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [monsterPhrase, setMonsterPhrase] = useState('');
  const phraseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const monsterPhraseTimerRef = useRef<NodeJS.Timeout | null>(null);
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
        const next = prev - (selectedMonster.pushSpeed * (TICK_INTERVAL / 1000));
        if (next <= 0) {
          setGameState('lost');
          return 0;
        }
        return next;
      });
    }, TICK_INTERVAL);

    return () => clearInterval(interval);
  }, [gameState, selectedMonster]);

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
    if (phraseTimerRef.current) clearTimeout(phraseTimerRef.current);
    setCurrentPhrase(phrase);
    phraseTimerRef.current = setTimeout(() => setCurrentPhrase(''), 1500);

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

    let strength = selectedMonster.activeStrength;
    
    // Ghost monster random strength
    if (selectedMonster.id === 'ghost') {
      strength = Math.floor(Math.random() * 8) + 1;
    }

    let phrase = selectedMonster.phrases[Math.floor(Math.random() * selectedMonster.phrases.length)];

    if (newConsecutive >= 5) {
      strength = strength * 2.5;
      setIsUltimate('monster');
      setTimeout(() => setIsUltimate(null), 1000);
      setMonsterConsecutive(0);
    }

    // Show monster phrase
    if (monsterPhraseTimerRef.current) clearTimeout(monsterPhraseTimerRef.current);
    setMonsterPhrase(phrase);
    monsterPhraseTimerRef.current = setTimeout(() => setMonsterPhrase(''), 1500);

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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (phraseTimerRef.current) clearTimeout(phraseTimerRef.current);
      if (monsterPhraseTimerRef.current) clearTimeout(monsterPhraseTimerRef.current);
    };
  }, []);

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
        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-sky-500 p-2 rounded-lg text-white">
            <Gamepad2 size={24} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-sky-900 hidden sm:block">공부 몬스터 퇴치!</h1>
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
                    className="absolute -top-12 left-1/2 -translate-x-[85%] bg-white px-4 py-2 rounded-2xl shadow-xl border-2 border-sky-200 text-sky-900 font-bold whitespace-nowrap z-30"
                  >
                    {currentPhrase}
                    <div className="absolute -bottom-2 right-4 w-4 h-4 bg-white border-r-2 border-b-2 border-sky-200 rotate-45" />
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
                  <DefaultBoy type={selectedBoy.id} />
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
                      "absolute -top-12 left-1/2 -translate-x-[15%] bg-white px-4 py-2 rounded-2xl shadow-xl border-2 border-red-200 text-red-900 font-bold whitespace-nowrap z-30",
                      isUltimate === 'monster' && "border-red-600 bg-red-50 text-red-700 scale-110"
                    )}
                  >
                    {monsterPhrase}
                    <div className="absolute -bottom-2 left-4 w-4 h-4 bg-white border-r-2 border-b-2 border-red-200 rotate-45" />
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
                  <DefaultMonster type={selectedMonster.id} />
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
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-30 w-full">
          <p className="text-sky-900/60 text-lg bg-white/50 px-4 py-2 rounded-full backdrop-blur-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[80%]">
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
            selectedBoy={selectedBoy}
            onSelectBoy={(b) => {
              setSelectedBoy(b);
              setBoyImage(null); // Reset custom image when switching types
            }}
            selectedMonster={selectedMonster}
            onSelectMonster={(m) => {
              setSelectedMonster(m);
              setMonsterImage(null); // Reset custom image when switching types
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function DefaultBoy({ type = 'kirby' }: { type?: string }) {
  const renderBoy = () => {
    switch (type) {
      case 'shyguy':
        return (
          <div className="relative w-32 h-44 flex flex-col items-center">
            {/* Body */}
            <div className="w-28 h-36 bg-red-500 rounded-[3rem] border-4 border-red-700 relative flex flex-col items-center pt-6 shadow-lg">
              {/* Mask */}
              <div className="w-22 h-26 bg-white rounded-full border-4 border-stone-200 relative flex flex-col items-center justify-center shadow-inner">
                {/* Eyes */}
                <div className="flex gap-4 mb-2">
                  <div className="w-4 h-7 bg-black rounded-full" />
                  <div className="w-4 h-7 bg-black rounded-full" />
                </div>
                {/* Mouth */}
                <div className="w-5 h-5 bg-black rounded-full" />
                {/* Mask Straps */}
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-8 bg-stone-800 rounded-full" />
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-8 bg-stone-800 rounded-full" />
              </div>
              {/* Belt */}
              <div className="absolute bottom-6 w-full h-4 bg-stone-800 flex items-center justify-center">
                <div className="w-6 h-6 bg-yellow-400 border-2 border-stone-900 rounded-sm" />
              </div>
            </div>
            {/* Feet */}
            <div className="absolute -bottom-2 flex gap-10">
              <div className="w-12 h-7 bg-blue-900 rounded-full border-b-4 border-blue-950 shadow-md" />
              <div className="w-12 h-7 bg-blue-900 rounded-full border-b-4 border-blue-950 shadow-md" />
            </div>
          </div>
        );
      case 'ninjago':
        return (
          <div className="relative w-32 h-44 flex flex-col items-center">
            {/* Lego Head/Hood */}
            <div className="w-28 h-36 bg-green-600 rounded-2xl border-4 border-green-800 relative flex flex-col items-center overflow-hidden shadow-lg">
              {/* Mask/Opening */}
              <div className="w-full h-14 bg-green-700 border-b-4 border-green-800 flex items-center justify-center mt-4">
                {/* Face Strip */}
                <div className="w-24 h-8 bg-yellow-400 rounded-sm flex items-center justify-center gap-6 relative">
                  {/* Eyes */}
                  <div className="w-4 h-1.5 bg-black rotate-12 rounded-full" />
                  <div className="w-4 h-1.5 bg-black -rotate-12 rounded-full" />
                  {/* Eyebrows */}
                  <div className="absolute top-1 left-6 w-4 h-0.5 bg-stone-800 -rotate-6" />
                  <div className="absolute top-1 right-6 w-4 h-0.5 bg-stone-800 rotate-6" />
                </div>
              </div>
              {/* Gi Details */}
              <div className="flex-1 w-full flex flex-col items-center pt-4 gap-3">
                <div className="w-20 h-1.5 bg-green-800 rounded-full opacity-50" />
                <div className="w-16 h-1.5 bg-green-800 rounded-full opacity-50" />
                {/* Ninja Symbol */}
                <div className="w-8 h-8 rounded-full border-2 border-green-800 flex items-center justify-center text-[10px] font-bold text-green-900">忍</div>
              </div>
            </div>
            {/* Hands (Lego style) */}
            <div className="absolute top-1/2 -left-4 w-6 h-6 border-4 border-yellow-500 rounded-full border-r-transparent -rotate-45" />
            <div className="absolute top-1/2 -right-4 w-6 h-6 border-4 border-yellow-500 rounded-full border-l-transparent rotate-45" />
          </div>
        );
      case 'pikmin':
        return (
          <div className="relative w-28 h-48 flex flex-col items-center">
            {/* Stem & Leaf */}
            <div className="absolute -top-14 w-1.5 h-20 bg-green-800 flex items-center justify-center">
              <motion.div 
                animate={{ rotate: [10, -10, 10] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="absolute -top-6 -left-4 w-10 h-14 bg-green-500 rounded-[100%_0%_100%_0%] border-2 border-green-700 shadow-sm" 
              />
            </div>
            {/* Body */}
            <div className="w-22 h-32 bg-red-500 rounded-full border-4 border-red-700 relative flex flex-col items-center pt-8 shadow-lg">
              {/* Big Eyes */}
              <div className="flex gap-2">
                <div className="w-8 h-10 bg-white rounded-full border-2 border-red-800 flex items-center justify-center">
                  <div className="w-3 h-5 bg-black rounded-full" />
                </div>
                <div className="w-8 h-10 bg-white rounded-full border-2 border-red-800 flex items-center justify-center">
                  <div className="w-3 h-5 bg-black rounded-full" />
                </div>
              </div>
              {/* Nose */}
              <div className="w-3 h-5 bg-red-700 rounded-full mt-1" />
            </div>
            {/* Feet */}
            <div className="flex gap-6 -mt-2">
              <div className="w-8 h-5 bg-red-700 rounded-full border-b-2 border-red-900" />
              <div className="w-8 h-5 bg-red-700 rounded-full border-b-2 border-red-900" />
            </div>
          </div>
        );
      default: // kirby
        return (
          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* Kirby Body */}
            <div className="w-32 h-32 bg-pink-300 rounded-full border-4 border-pink-400 relative shadow-[inset_-8px_-8px_20px_rgba(0,0,0,0.1)] flex items-center justify-center">
              {/* Eyes */}
              <div className="absolute top-[30%] left-[30%] w-3.5 h-10 bg-black rounded-full overflow-hidden">
                <div className="absolute top-1 left-1 w-1.5 h-3 bg-white rounded-full" />
                <div className="absolute bottom-1 left-0 w-full h-3 bg-blue-500" />
              </div>
              <div className="absolute top-[30%] right-[30%] w-3.5 h-10 bg-black rounded-full overflow-hidden">
                <div className="absolute top-1 left-1 w-1.5 h-3 bg-white rounded-full" />
                <div className="absolute bottom-1 left-0 w-full h-3 bg-blue-500" />
              </div>
              {/* Mouth */}
              <div className="absolute top-[55%] w-4 h-2 bg-pink-600 rounded-full" />
              {/* Cheeks */}
              <div className="absolute top-[50%] left-4 w-7 h-3.5 bg-pink-400 rounded-full opacity-50 blur-[1px]" />
              {/* Study Glasses (Themed) */}
              <div className="absolute top-1/3 -translate-y-1/2 left-2 right-2 flex justify-between z-10 pointer-events-none">
                <div className="w-14 h-14 border-4 border-stone-800 rounded-full bg-white/20 backdrop-blur-[1px]" />
                <div className="w-14 h-14 border-4 border-stone-800 rounded-full bg-white/20 backdrop-blur-[1px]" />
              </div>
              <div className="absolute top-1/3 -translate-y-1/2 left-1/2 -translate-x-1/2 w-4 h-1.5 bg-stone-800 z-10" />
            </div>
            {/* Kirby Feet */}
            <div className="absolute -bottom-2 -left-1 w-14 h-8 bg-red-500 rounded-full border-b-4 border-red-700 rotate-[-10deg] shadow-md" />
            <div className="absolute -bottom-2 -right-1 w-14 h-8 bg-red-500 rounded-full border-b-4 border-red-700 rotate-[10deg] shadow-md" />
          </div>
        );
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      {renderBoy()}
      <p className="mt-4 text-stone-900 font-bold text-xl bg-white/80 px-4 py-1 rounded-full">
        나 ({BOYS.find(b => b.id === type)?.name || '열공 소년'})
      </p>
    </div>
  );
}

function DefaultMonster({ type = 'wolf' }: { type?: string }) {
  const renderMonster = () => {
    switch (type) {
      case 'slime':
        return (
          <div className="w-32 h-24 bg-emerald-400 rounded-t-full border-4 border-emerald-600 relative flex items-center justify-center">
            <div className="absolute top-1/4 left-1/4 w-4 h-4 bg-white rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-black rounded-full" />
            </div>
            <div className="absolute top-1/4 right-1/4 w-4 h-4 bg-white rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-black rounded-full" />
            </div>
            <div className="absolute bottom-4 w-12 h-2 bg-emerald-600 rounded-full" />
          </div>
        );
      case 'dragon':
        return (
          <div className="relative w-32 h-32 bg-red-500 rounded-lg border-4 border-red-700 flex flex-col items-center justify-center">
            <div className="absolute -top-6 flex gap-4">
              <div className="w-6 h-8 bg-red-700 clip-triangle" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
              <div className="w-6 h-8 bg-red-700 clip-triangle" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
            </div>
            <div className="flex gap-4 mb-2">
              <div className="w-4 h-4 bg-yellow-300 rounded-full border-2 border-red-900" />
              <div className="w-4 h-4 bg-yellow-300 rounded-full border-2 border-red-900" />
            </div>
            <div className="w-16 h-8 bg-red-900 rounded-b-lg flex items-center justify-center">
              <div className="w-2 h-2 bg-orange-500 animate-pulse" />
            </div>
          </div>
        );
      case 'ghost':
        return (
          <div className="w-32 h-40 bg-white/80 rounded-t-full border-4 border-indigo-200 relative flex flex-col items-center pt-8">
            <div className="flex gap-6 mb-4">
              <div className="w-4 h-4 bg-indigo-900 rounded-full" />
              <div className="w-4 h-4 bg-indigo-900 rounded-full" />
            </div>
            <div className="w-8 h-8 border-4 border-indigo-900 rounded-full" />
            <div className="absolute bottom-0 left-0 right-0 h-8 flex justify-around">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-6 h-8 bg-white/80 rounded-full -mb-4" />
              ))}
            </div>
          </div>
        );
      default:
        return (
          <div className="w-32 h-32 bg-stone-300 border-4 border-stone-400 relative flex flex-col items-center justify-center">
            <div className="w-24 h-16 bg-stone-200 border-2 border-stone-400 relative">
              <div className="absolute top-2 left-4 w-3 h-3 bg-black" />
              <div className="absolute top-2 right-4 w-3 h-3 bg-black" />
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-4 bg-stone-800" />
            </div>
            <div className="absolute -top-4 left-4 w-6 h-6 bg-stone-300 border-2 border-stone-400" />
            <div className="absolute -top-4 right-4 w-6 h-6 bg-stone-300 border-2 border-stone-400" />
          </div>
        );
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      {renderMonster()}
      <p className="mt-4 text-stone-900 font-bold text-xl bg-white/80 px-4 py-1 rounded-full">
        {MONSTERS.find(m => m.id === type)?.name || '공부 몬스터'}
      </p>
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
  onSelectKey,
  selectedBoy,
  onSelectBoy,
  selectedMonster,
  onSelectMonster
}: { 
  onClose: () => void;
  onGenerateBoy: (img: string) => void;
  onGenerateMonster: (img: string) => void;
  apiKeySelected: boolean;
  onSelectKey: () => void;
  selectedBoy: BoyConfig;
  onSelectBoy: (b: BoyConfig) => void;
  selectedMonster: MonsterConfig;
  onSelectMonster: (m: MonsterConfig) => void;
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
        ? `A character representing ${selectedBoy.name}, ${selectedBoy.description}, 3D render, white background, high quality, vibrant colors`
        : `A monster character representing ${selectedMonster.name}, ${selectedMonster.description}, 3D render, white background, high quality, vibrant colors`;

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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-stone-900">게임 설정</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full">
            <X size={28} />
          </button>
        </div>

        {/* Boy Selection */}
        <section className="mb-8 border-t border-stone-100 pt-8">
          <h3 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-2">
            <div className="bg-sky-100 p-2 rounded-lg text-sky-600">👤</div>
            나의 캐릭터 선택
          </h3>

          {/* Boy Preview Card */}
          <div className="mb-6 bg-sky-50 rounded-3xl p-6 border-2 border-sky-100 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-32 h-32 flex-shrink-0">
              <DefaultBoy type={selectedBoy.id} />
            </div>
            <div className="text-center sm:text-left">
              <h4 className="text-2xl font-bold text-sky-900 mb-2">{selectedBoy.name}</h4>
              <p className="text-sky-700 text-sm leading-relaxed">{selectedBoy.description}</p>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-sky-200 text-xs font-bold text-sky-600">
                <span>{selectedBoy.icon}</span>
                <span>선택됨</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {BOYS.map(boy => (
              <button
                key={boy.id}
                onClick={() => onSelectBoy(boy)}
                className={cn(
                  "p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center gap-2 group",
                  selectedBoy.id === boy.id 
                    ? "border-sky-500 bg-white ring-2 ring-sky-200 shadow-sm" 
                    : "border-stone-100 bg-stone-50/50 hover:border-sky-200 hover:bg-white"
                )}
              >
                <span className={cn(
                  "text-3xl transition-transform group-hover:scale-110",
                  selectedBoy.id === boy.id ? "scale-110" : ""
                )}>{boy.icon}</span>
                <span className="font-bold text-stone-900 text-sm">{boy.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Monster Selection */}
        <section className="mb-8 border-t border-stone-100 pt-8">
          <h3 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-2">
            <div className="bg-red-100 p-2 rounded-lg text-red-600">👾</div>
            몬스터 선택
          </h3>

          {/* Monster Preview Card */}
          <div className="mb-6 bg-red-50 rounded-3xl p-6 border-2 border-red-100 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-32 h-32 flex-shrink-0">
              <DefaultMonster type={selectedMonster.id} />
            </div>
            <div className="text-center sm:text-left">
              <h4 className="text-2xl font-bold text-red-900 mb-2">{selectedMonster.name}</h4>
              <p className="text-red-700 text-sm leading-relaxed">{selectedMonster.description}</p>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-red-200 text-xs font-bold text-red-600">
                <span>{selectedMonster.icon}</span>
                <span>선택됨</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MONSTERS.map(monster => (
              <button
                key={monster.id}
                onClick={() => onSelectMonster(monster)}
                className={cn(
                  "p-4 rounded-2xl border-2 text-left transition-all group",
                  selectedMonster.id === monster.id 
                    ? "border-red-500 bg-white ring-2 ring-red-200 shadow-sm" 
                    : "border-stone-100 bg-stone-50/50 hover:border-red-200 hover:bg-white"
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl group-hover:scale-110 transition-transform">{monster.icon}</span>
                  <span className="font-bold text-stone-900">{monster.name}</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">{monster.description}</p>
                <div className="mt-3 flex gap-2">
                  <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-stone-200">속도: {monster.pushSpeed}</span>
                  <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-stone-200">파워: {monster.activeStrength || '랜덤'}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* AI Character Generation */}
        <section className="mb-8 border-t border-stone-100 pt-8">
          <h3 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-2">
            <Sparkles className="text-sky-500" size={24} />
            AI 캐릭터 생성
          </h3>
          
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
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-stone-700">이미지 품질</label>
                <div className="flex gap-2">
                  {(['1K', '2K', '4K'] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => setImageSize(size)}
                      className={cn(
                        "px-4 py-2 rounded-lg border-2 font-bold transition-all",
                        imageSize === size ? "bg-sky-500 border-sky-600 text-white" : "border-stone-100 text-stone-600 hover:bg-stone-50"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => generateImage('boy')}
                  disabled={!!isGenerating}
                  className="flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-dashed border-sky-200 hover:bg-sky-50 transition-colors group"
                >
                  <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center text-sky-500 group-hover:scale-110 transition-transform">
                    {isGenerating === 'boy' ? <Loader2 className="animate-spin" size={32} /> : <ImageIcon size={32} />}
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sky-900">나({selectedBoy.name}) 생성</p>
                    <p className="text-xs text-sky-700 mt-1">{selectedBoy.name} 스타일</p>
                  </div>
                </button>

                <button
                  onClick={() => generateImage('monster')}
                  disabled={!!isGenerating}
                  className="flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-dashed border-red-200 hover:bg-red-50 transition-colors group"
                >
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                    {isGenerating === 'monster' ? <Loader2 className="animate-spin" size={32} /> : <ImageIcon size={32} />}
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-red-900">몬스터 생성</p>
                    <p className="text-xs text-red-700 mt-1">{selectedMonster.name} 스타일</p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </section>

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
