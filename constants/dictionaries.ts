export const WORDS_COMMON = [
  // Function words
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with",
  "he", "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what", "so", "up", "out", "if",
  "about", "who", "get", "which", "go", "me", "when", "make", "can", "like", "time", "no", "just", "him",
  "know", "take", "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
  "than", "then", "now", "look", "only", "come", "its", "over", "think", "also", "back", "after", "use",
  "two", "how", "our", "work", "first", "well", "way", "even", "new", "want", "because", "any", "these",
  "give", "day", "most", "us", "great", "between", "need", "large", "often", "hand", "high", "place",
  "hold", "turn", "here", "why", "help", "talk", "move", "live", "still", "should", "many", "number",
  "off", "always", "those", "both", "mark", "book", "letter", "until", "mile", "river", "car", "feet",
  "care", "second", "enough", "plain", "girl", "usual", "young", "ready", "above", "ever", "red", "list",
  "though", "feel", "talk", "bird", "soon", "body", "dog", "family", "direct", "pose", "leave", "song",
  "measure", "door", "product", "black", "short", "numeral", "class", "wind", "question", "happen",
  "complete", "ship", "area", "half", "rock", "order", "fire", "south", "problem", "piece", "told",
  "knew", "pass", "since", "top", "whole", "king", "space", "heard", "best", "hour", "better", "true",
  "during", "hundred", "five", "remember", "step", "early", "hold", "west", "ground", "interest", "reach",
  "fast", "verb", "sing", "listen", "six", "table", "travel", "less", "morning", "ten", "simple", "several",
  "vowel", "toward", "war", "lay", "against", "pattern", "slow", "center", "love", "person", "money",
  "serve", "appear", "road", "map", "rain", "rule", "govern", "pull", "cold", "notice", "voice", "fall",
  "power", "town", "fine", "drive", "lead", "cry", "dark", "machine", "note", "wait", "plan", "figure",
  "star", "box", "noun", "field", "rest", "correct", "able", "pound", "done", "beauty", "drive", "stood",
  // Technical words — relevant for typists
  "typrox", "typing", "performance", "terminal", "responsiveness", "interface", "compiler",
  "asynchronous", "analytics", "architecture", "precision", "latency", "algorithm", "function",
  "variable", "constant", "parameter", "component", "framework", "database", "network", "protocol",
  "iteration", "recursion", "abstraction", "deployment", "validation", "authentication", "encryption",
  "bandwidth", "throughput", "memory", "processor", "software", "hardware", "library", "module",
  "repository", "pipeline", "container", "middleware", "endpoint", "request", "response", "client",
  "server", "render", "thread", "process", "runtime", "syntax", "semantic", "pointer", "reference",
  "object", "method", "property", "interface", "abstract", "instance", "inherit", "override", "extend",
];

export const QUOTES = [
  {
    text: "The only limit to our realization of tomorrow will be our doubts of today.",
    source: "Franklin D. Roosevelt"
  },
  {
    text: "Quality is not an act, it is a habit.",
    source: "Aristotle"
  },
  {
    text: "Simplicity is the ultimate sophistication.",
    source: "Leonardo da Vinci"
  },
  {
    text: "Computers are useless. They can only give you answers.",
    source: "Pablo Picasso"
  },
  {
    text: "Talk is cheap. Show me the code.",
    source: "Linus Torvalds"
  },
  {
    text: "Programs must be written for people to read, and only incidentally for machines to execute.",
    source: "Harold Abelson"
  },
  {
    text: "The best way to predict the future is to invent it.",
    source: "Alan Kay"
  },
  {
    text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.",
    source: "Martin Fowler"
  },
  {
    text: "First, solve the problem. Then, write the code.",
    source: "John Johnson"
  },
  {
    text: "Experience is the name everyone gives to their mistakes.",
    source: "Oscar Wilde"
  },
  {
    text: "In order to be irreplaceable one must always be different.",
    source: "Coco Chanel"
  },
  {
    text: "Java is to JavaScript what car is to carpet.",
    source: "Chris Heilmann"
  },
  {
    text: "Knowledge is power. Power to do evil, or power to do good. Power itself is not evil.",
    source: "Veronica Roth"
  },
  {
    text: "It always seems impossible until it is done.",
    source: "Nelson Mandela"
  },
  {
    text: "The secret of getting ahead is getting started.",
    source: "Mark Twain"
  },
  {
    text: "Do not wait to strike till the iron is hot, but make it hot by striking.",
    source: "William Butler Yeats"
  },
  {
    text: "Whether you think you can or you think you cannot, you are right.",
    source: "Henry Ford"
  },
  {
    text: "A person who never made a mistake never tried anything new.",
    source: "Albert Einstein"
  },
  {
    text: "Imagination is more important than knowledge. Knowledge is limited. Imagination encircles the world.",
    source: "Albert Einstein"
  },
  {
    text: "The function of good software is to make the complex appear to be simple.",
    source: "Grady Booch"
  },
  {
    text: "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.",
    source: "Antoine de Saint-Exupery"
  },
  {
    text: "Walking on water and developing software from a specification are easy if both are frozen.",
    source: "Edward V. Berard"
  },
  {
    text: "The most disastrous thing that you can ever learn is your first programming language.",
    source: "Alan Kay"
  },
  {
    text: "Code is like humor. When you have to explain it, it is bad.",
    source: "Cory House"
  }
];

export const CODE_SNIPPETS = [
  "const calculateWpm = (chars, time) => Math.round((chars / 5) / (time / 60));",
  "interface TypingEvent { key: string; time: number; index: number; }",
  "export default function Page() { return <main className=\"flex h-screen\" />; }",
  "fn main() { println!(\"TyProX typing engine online!\"); }",
  "def get_rsd(intervals): return std_dev(intervals) / mean(intervals)",
  "const [status, setStatus] = useState<'idle' | 'running'>('idle');",
  "git commit -m \"perf: offload telemetry processing to Web Workers\"",
  "const worker = new Worker(new URL('./analytics.worker.ts', import.meta.url));",
  "SELECT wpm, accuracy FROM test_results WHERE user_id = $1 ORDER BY created_at DESC;",
  "async function fetchProfile(id: string) { const { data } = await supabase.from('profiles').select('*').eq('id', id).single(); return data; }",
  "type Result = { wpm: number; accuracy: number; consistency: number; duration: number; };",
  "useEffect(() => { return () => clearInterval(timerRef.current); }, []);",
  "const debounce = (fn, ms) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };",
  "export const getRankTier = (wpm) => wpm >= 140 ? 'Grandmaster' : wpm >= 100 ? 'Diamond' : 'Silver';",
  "CREATE TABLE test_results (id uuid PRIMARY KEY, user_id uuid REFERENCES profiles(id), wpm integer, accuracy integer, created_at timestamptz DEFAULT now());",
  "const sorted = arr.slice().sort((a, b) => b.wpm - a.wpm);",
  "self.onmessage = ({ data }) => { const { type, payload } = data; if (type === 'KEYSTROKE') processKeystroke(payload); };",
  "import { create } from 'zustand'; export const useStore = create((set) => ({ count: 0, increment: () => set((s) => ({ count: s.count + 1 })) }));",
  "npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias @/*",
  "z.object({ wpm: z.number().min(0).max(350), accuracy: z.number().min(0).max(100) })",
  ".from('leaderboard').select('id, wpm, profiles(username)').order('wpm', { ascending: false }).limit(50)",
  "const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;",
];
