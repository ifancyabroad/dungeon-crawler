import { Routes, Route } from "react-router-dom";
import Game from "./pages/Game";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";

export default function App() {
	return (
		<Routes>
			<Route index element={<Landing />} />
			<Route path="game" element={<Game />} />
			<Route path="*" element={<NotFound />} />
		</Routes>
	);
}
