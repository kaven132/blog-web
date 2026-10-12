import { useState } from "react";
import GameModal from "./GameModal";
import Tetris from "./Tetris";
import Snake from "./Snake";
import Game2048 from "./Game2048";
import Minesweeper from "./Minesweeper";
import PacMan from "./PacMan";

interface GameLauncherProps {
  game: string;
  title: string;
  subtitle: string;
}

/**
 * 游戏卡片上的「开始游戏」按钮 + 弹窗，按 game id 渲染对应对局组件。
 * 新游戏上线：实现组件 → 在这里加一个分支 → games.astro 的 games 数组加一张卡片。
 */
export default function GameLauncher({ game, title, subtitle }: GameLauncherProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`开始${title}`}
        className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
      >
        开始游戏
      </button>

      {open && (
        <GameModal title={title} subtitle={subtitle} onClose={() => setOpen(false)}>
          {game === "tetris" ? (
            <Tetris />
          ) : game === "snake" ? (
            <Snake />
          ) : game === "2048" ? (
            <Game2048 />
          ) : game === "pacman" ? (
            <PacMan />
          ) : (
            <Minesweeper />
          )}
        </GameModal>
      )}
    </>
  );
}
