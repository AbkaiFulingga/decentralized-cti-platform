// Canonical /visualization route implementation.
//
// NOTE: This file is intentionally kept in sync with `page.jsx` to avoid
// Next.js duplicate-route conflicts in environments where both exist.
import IOCUniverse from '@/components/IOCUniverse';

export default function VisualizationPage() {
	return (
		<main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 py-12 px-4">
			<div className="max-w-7xl mx-auto">
				<IOCUniverse />
			</div>
		</main>
	);
}
