import React from 'react';
import { LcdReader } from './components/LcdReader';

export const App: React.FC = () => {
  return (
    <div style={{ height: '100dvh', width: '100vw', margin: 0, padding: 0, overflow: 'hidden', backgroundColor: '#000000' }}>
      <LcdReader />
    </div>
  );
};

export default App;
