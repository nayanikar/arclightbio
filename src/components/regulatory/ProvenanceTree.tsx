"use client";

interface ProvenanceNode {
  id: string;
  claim: string;
  agent: string;
  source: string;
  sourceType: string;
  timestamp: string;
  children: Array<{ label: string; value: string }>;
}

interface ProvenanceTreeProps {
  nodes: ProvenanceNode[];
}

export function ProvenanceTree({ nodes }: ProvenanceTreeProps) {
  return (
    <div className="space-y-3">
      {nodes.map((node) => (
        <div
          key={node.id}
          className="rounded-lg border border-gray-200 bg-white p-4"
        >
          <p className="text-sm font-medium text-gray-900">{node.claim}</p>
          <div className="mt-2 space-y-1 border-l-2 border-brand-purple/30 pl-4">
            {node.children.map((child) => (
              <div key={child.label} className="text-xs text-gray-600">
                <span className="font-medium text-gray-500">{child.label}:</span>{" "}
                {child.value}
              </div>
            ))}
            {node.source && (
              <a
                href={node.source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-purple hover:underline"
              >
                {node.sourceType} → {node.source.slice(0, 60)}...
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
