import { HashRouter, Route, Routes } from 'react-router-dom';
import Title from './pages/Title';
import CharacterCreator from './pages/CharacterCreator';
import Dashboard from './pages/Dashboard';
import ElectionCenter from './pages/ElectionCenter';
import Cabinet from './pages/Cabinet';
import Archive from './pages/Archive';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Title />} />
        <Route path="/create" element={<CharacterCreator />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/election" element={<ElectionCenter />} />
        <Route path="/cabinet" element={<Cabinet />} />
        <Route path="/archive" element={<Archive />} />
      </Routes>
    </HashRouter>
  );
}
