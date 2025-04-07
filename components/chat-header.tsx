import { FiInfo } from "react-icons/fi";
import { GiScales } from "react-icons/gi";

export default function ChatHeader() {
  return (
    <header className="bg- text-white py-6">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <GiScales className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">
                Legal Voice Against Injustice
              </h1>
              <p className="text-purple-200 text-sm">
                AI-powered legal document analysis
              </p>
            </div>
          </div>
          <button className="p-2 rounded-full hover:bg-purple-700 transition-colors">
            <FiInfo className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
