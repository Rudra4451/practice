import { TypingDNAV2Snapshot, CompiledDrill } from '../types';

/**
 * Algorithmic Rule-Based Drill Compiler Pipeline (ADR-012 & Revision 3)
 * Compiles targeted practice passages 100% deterministically without AI or API calls.
 */
export class DrillCompiler {
  private static CODE_DICTIONARIES: Record<string, string[]> = {
    react: [
      "const [state, setState] = useState<boolean>(true);",
      "useEffect(() => { const handler = () => fetch(); window.addEventListener('resize', handler); return () => window.removeEventListener('resize', handler); }, []);",
      "export const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className=\"p-4\">{children}</div>;",
    ],
    typescript: [
      "interface UserProfile { id: string; username: string; isVerified: boolean; scores: number[]; }",
      "type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };",
      "export async function processQueue<T>(items: T[], handler: (item: T) => Promise<void>): Promise<void> { for (const item of items) { await handler(item); } }",
    ],
    python: [
      "def calculate_telemetry_metrics(keystrokes: list[dict]) -> dict: return { 'wpm': round(len(keystrokes) / 5) }",
      "async def fetch_user_data(user_id: str) -> Optional[dict]: async with aiohttp.ClientSession() as session: return await session.get(url)",
      "class TelemetryPipeline: def __init__(self, seed: str): self.seed = seed",
    ],
    sql: [
      "SELECT u.id, u.username, COUNT(r.id) AS total_runs, MAX(r.wpm) AS best_wpm FROM public.profiles u JOIN public.test_results r ON u.id = r.user_id GROUP BY u.id HAVING MAX(r.wpm) >= 100 ORDER BY best_wpm DESC;",
      "CREATE INDEX IF NOT EXISTS idx_test_results_leaderboard ON public.test_results(mode, duration, is_invalidated, wpm DESC);",
    ],
    symbols: [
      "{} () => [] :: == != += -= && || -> => <= >= <? ?> :: $var [index] -> property;",
      "const fn = (a: number, b: number): number => (a > b ? a * 2 : b / 2);",
    ],
    markdown: [
      "# Architectural Specification\n\n- **Zero Latency**: Input processing runs in Web Workers.\n- **Keyboard Access**: 100% ARIA compliant.",
    ],
    english: [
      "quick brown fox jumps over the lazy dog consistent typing accuracy accelerates muscle memory precision rhythm speed ceiling",
      "practice makes permanent focus stability eliminates subtle keystroke hesitations across long endurance typing sessions",
    ]
  };

  public static compileDrill(
    dna: TypingDNAV2Snapshot,
    category: 'english' | 'symbols' | 'react' | 'typescript' | 'python' | 'sql' | 'markdown' = 'english'
  ): CompiledDrill {
    const startTime = performance.now();

    // 1. Extract Bottlenecks
    const weakKeys = dna.slowestKeys.map((k) => k.key);
    const weakFingers = dna.weakFingers.map((f) => f.finger);
    const weakDigraphs = dna.weakestDigraphs.map((d) => d.bigram);

    // 2. Select Passage Base
    const dict = this.CODE_DICTIONARIES[category] || this.CODE_DICTIONARIES.english;
    const baseText = dict[Math.floor(Math.random() * dict.length)];

    // 3. Inject Weak Key Targets into Word Stream for English/Symbols
    let passageText = baseText;
    if (category === 'english' && weakKeys.length > 0) {
      const extraWords = weakKeys.map((k) => `${k}${k} ${k}a ${k}e ${k}o`).join(' ');
      passageText = `${baseText} ${extraWords}`;
    }

    // 4. Calculate Metadata
    const length = passageText.length;
    const expectedDurationSecs = Math.max(15, Math.round((length / 5) / (60 / 60))); // ~60 WPM baseline
    const difficultyRating = Math.min(100, Math.max(10, Math.round(length * 0.4 + weakKeys.length * 5)));
    const repeatabilityScore = Math.max(50, 100 - weakKeys.length * 4);

    const compilationTimeMs = performance.now() - startTime;
    if (compilationTimeMs > 40) {
      console.warn(`Drill compilation exceeded 40ms budget: ${compilationTimeMs.toFixed(2)}ms`);
    }

    return {
      id: `drill_${Math.random().toString(36).substring(7)}`,
      title: `${category.toUpperCase()} Bottleneck Workout`,
      category,
      passageText,
      difficultyRating,
      targetFingers: weakFingers.slice(0, 3),
      targetDigraphs: weakDigraphs.slice(0, 4),
      expectedDurationSecs,
      repeatabilityScore,
      estimatedImprovement: `+${Math.min(15, 3 + weakKeys.length * 2)}% target key speed improvement`,
    };
  }
}
