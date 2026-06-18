import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, "../..");

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), "utf8");
}

describe("mobile tab cache and transit map contracts", () => {
  it("seeds Services from the in-memory offline cache before first render", () => {
    const source = readMobile("app/(tabs)/services.tsx");

    expect(source).toContain("peekOfflineCache(SERVICES_CACHE, readServicesCache)");
    expect(source).toContain("useState(() => !initialServicesCache)");
    expect(source).toContain("useRef(Boolean(initialServicesCache))");
    expect(source).toContain("if (!hasDataRef.current) setLoading(true)");
  });

  it("seeds Moving from the in-memory offline cache before first render", () => {
    const source = readMobile("app/(tabs)/moving.tsx");

    expect(source).toContain("peekOfflineCache(MOVING_CACHE, asArray)");
    expect(source).toContain("useState(() => !initialMovingCache)");
    expect(source).toContain("useRef(Boolean(initialMovingCache))");
    expect(source).toContain("if (!hasDataRef.current) setLoading(true)");
  });

  it("does not reserve the mobile transit map frame until the image loads", () => {
    const source = readMobile("src/components/addresses/TransitRouteMap.tsx");

    expect(source).toContain("const [loaded, setLoaded] = useState(false)");
    expect(source).toContain("!loaded && styles.preloadFrame");
    expect(source).toContain("onLoad={() => setLoaded(true)}");
  });

  it("keeps a loaded transit map visible across same-route background refreshes", () => {
    const source = readMobile("src/components/addresses/TransitRouteMap.tsx");

    expect(source).toContain("const previousUriRef = useRef<string | null>(null)");
    expect(source).toContain("}, [routeKey])");
    expect(source).toContain("if (previousUriRef.current !== uri)");
    expect(source).not.toContain("}, [coords])");
  });
});
