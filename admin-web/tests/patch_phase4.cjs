const fs = require('fs');
const path = require('path');

const ssbPath = path.resolve(__dirname, '../src/components/search/SmartSearchBar.jsx');
let ssbCode = fs.readFileSync(ssbPath, 'utf8');

const targetRegex = /\/\*\*[\s\S]*?Safely highlights matching substring[\s\S]*?\*\/[\s\S]*?function HighlightedText\(\{ text, query \}\) \{[\s\S]*?\n\}/;

const newHighlightedText = `/**
 * Safely highlights matching substring(s) using pure React elements and safe text segments.
 * Never generates or injects HTML strings.
 * Preserves exact original text, casing, and RTL/LTR formatting.
 */
function HighlightedText({ text, query }) {
  if (!text) return null;
  if (!query || !query.trim()) return <span>{text}</span>;

  const cleanQuery = query.trim();
  // Escape regex special characters to prevent regex injection or syntax errors
  const escapedQuery = cleanQuery.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
  const regex = new RegExp('(' + escapedQuery + ')', 'gi');

  const parts = text.split(regex);
  if (parts.length === 1) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === cleanQuery.toLowerCase();
        return isMatch ? (
          <span
            key={index}
            className="font-bold text-[#C8102E] bg-[#FDF2F4] rounded px-0.5"
            dir="auto"
          >
            {part}
          </span>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        );
      })}
    </span>
  );
}`;

if (targetRegex.test(ssbCode)) {
  ssbCode = ssbCode.replace(targetRegex, () => newHighlightedText);
  fs.writeFileSync(ssbPath, ssbCode, 'utf8');
  console.log('SmartSearchBar.jsx successfully patched with function replacer.');
} else {
  console.log('Target regex did not match in SmartSearchBar.jsx');
}
