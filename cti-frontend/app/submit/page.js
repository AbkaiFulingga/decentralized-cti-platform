// app/submit/page.js
import IOCSubmissionForm from '../../components/IOCSubmissionForm';

export default function SubmitPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1a0b2e] via-purple-900/20 to-black p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-4">Submit IOC Batch</h1>
        <p className="text-gray-400 mb-8">Upload threat indicators to the decentralized network</p>
        <IOCSubmissionForm />
      </div>
    </main>
  );
}
