import { Routes, Route } from "react-router-dom";
import { ErrorModal } from "./components/ErrorModal";
import CharacterCreate from "./pages/CharacterCreate";
import Game from "./pages/Game";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";

export default function App() {
	return (
		<>
			<ErrorModal />
			<Routes>
				<Route index element={<Landing />} />
				<Route path="character-create" element={<CharacterCreate />} />
				<Route path="game" element={<Game />} />
				<Route path="*" element={<NotFound />} />
			</Routes>
		</>
	);
}
