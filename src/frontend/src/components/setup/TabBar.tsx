import { cn } from "../../utils/cn";

type TabId = "config" | "questions";

type Props = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "config", label: "クイズ設定" },
  { id: "questions", label: "問題管理" },
];

export function TabBar({ activeTab, onTabChange }: Props) {
  return (
    <div className="flex border-b border-gray-200 mb-6">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "px-6 py-3 text-sm font-semibold transition-colors duration-150 border-b-2 -mb-px",
            activeTab === tab.id
              ? "border-accent text-accent"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
