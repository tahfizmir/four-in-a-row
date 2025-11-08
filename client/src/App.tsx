import React, { useState } from 'react';
import Lobby from './pages/Lobby';
import GameBoard from './pages/GameBoard';

type View = 'lobby' | 'game';

export default function App() {
  const [view, setView] = useState<View>('lobby');
  const [initial, setInitial] = useState<any>(null);

  return (
    <div className="app">
      {view === 'lobby' && <Lobby onStart={(data: any) => { setInitial(data); setView('game'); }} />}
      {view === 'game' && <GameBoard initial={initial} onExit={() => setView('lobby')} />}
    </div>
  );
}
