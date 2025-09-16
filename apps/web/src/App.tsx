import { Routes, Route } from "react-router-dom";
import Game from "./pages/Game";
import NotFound from "./pages/NotFound";

export default function App() {
	return (
		<Routes>
			<Route index element={<Game />} />
			<Route path="*" element={<NotFound />} />
		</Routes>
	);
}
