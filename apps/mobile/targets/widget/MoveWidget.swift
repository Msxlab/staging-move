// UNVERIFIED — requires a native EAS build + device test; native rendering not checked remotely.
//
// MoveWidget.swift — iOS WidgetKit extension for the LocateFlow home-screen widget.
//
// This Swift/SwiftUI file is the iOS counterpart of the JS widget. It is scaffolded
// here for completeness but CANNOT be compiled or rendered in this environment:
// Swift is not typecheckable remotely, and a WidgetKit timeline only renders on a
// real iOS build (via `eas build`) on a device/simulator. Treat everything below
// as a starting point to validate on the owner's native build.
//
// Data flow:
//   - The React Native data layer (src/lib/widget-data.ts) computes a snapshot and,
//     on a native build, writes it as JSON into the App Group UserDefaults under the
//     key WIDGET_SNAPSHOT_KEY ("locateflow.widget.snapshot.v1").
//   - This extension reads that App Group, decodes the snapshot, and renders the
//     glanceable countdown + next task + readiness %.
//   - After writing, the JS side calls WidgetCenter.shared.reloadAllTimelines() (via
//     the native App Group bridge) so this timeline refreshes.
//
// App Group + key MUST match src/lib/widget-data.ts:
//   WIDGET_APP_GROUP   = "group.com.locateflow.mobile.widget"
//   WIDGET_SNAPSHOT_KEY = "locateflow.widget.snapshot.v1"

import WidgetKit
import SwiftUI

// MARK: - Shared constants (keep in sync with src/lib/widget-data.ts)

private let kAppGroup = "group.com.locateflow.mobile.widget"
private let kSnapshotKey = "locateflow.widget.snapshot.v1"

// MARK: - Snapshot model (mirrors the WidgetSnapshot TS interface)

struct MoveSnapshot: Codable {
    var daysToGo: Int?
    var phase: String          // "upcoming" | "today" | "past" | "none"
    var nextTaskTitle: String?
    var readinessPercent: Int
    var routeLabel: String?
    var updatedAt: String

    static let empty = MoveSnapshot(
        daysToGo: nil,
        phase: "none",
        nextTaskTitle: nil,
        readinessPercent: 0,
        routeLabel: nil,
        updatedAt: ""
    )

    /// Read + decode the latest snapshot from the App Group UserDefaults.
    /// Falls back to `.empty` whenever the value is missing or malformed so the
    /// widget always has something coherent to draw.
    static func load() -> MoveSnapshot {
        guard
            let defaults = UserDefaults(suiteName: kAppGroup),
            let raw = defaults.string(forKey: kSnapshotKey),
            let data = raw.data(using: .utf8),
            let decoded = try? JSONDecoder().decode(MoveSnapshot.self, from: data)
        else {
            return .empty
        }
        return decoded
    }

    /// "N days to go" / "Moving day!" / "N days ago" / no-plan headline.
    var countdownHeadline: String {
        guard let days = daysToGo, phase != "none" else { return "Plan your move" }
        if phase == "today" { return "Moving day!" }
        let n = abs(days)
        if phase == "past" { return n == 1 ? "1 day ago" : "\(n) days ago" }
        return n == 1 ? "1 day to go" : "\(n) days to go"
    }

    /// Secondary line: the next task, or an "all set" / CTA fallback.
    var nextLine: String {
        if phase == "none" { return "Tap to start your move plan" }
        if let title = nextTaskTitle, !title.isEmpty { return title }
        if readinessPercent >= 100 { return "You're all set" }
        return "No open tasks right now"
    }

    var hasPlan: Bool { phase != "none" && daysToGo != nil }
}

// MARK: - Timeline

struct MoveEntry: TimelineEntry {
    let date: Date
    let snapshot: MoveSnapshot
}

struct MoveProvider: TimelineProvider {
    func placeholder(in context: Context) -> MoveEntry {
        MoveEntry(date: Date(), snapshot: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (MoveEntry) -> Void) {
        completion(MoveEntry(date: Date(), snapshot: MoveSnapshot.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MoveEntry>) -> Void) {
        let entry = MoveEntry(date: Date(), snapshot: MoveSnapshot.load())
        // The JS side reloads timelines on each write; we also refresh ~hourly as a
        // safety net in case the app hasn't run.
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - View

struct MoveWidgetView: View {
    var entry: MoveEntry

    private let bg = Color(red: 0.039, green: 0.059, blue: 0.094)        // #0A0F18
    private let textColor = Color(red: 0.949, green: 0.961, blue: 0.980) // #F2F5FA
    private let dim = Color(red: 0.541, green: 0.596, blue: 0.675)       // #8A98AC
    private let accent = Color(red: 0.498, green: 0.714, blue: 0.910)    // #7FB6E8
    private let success = Color(red: 0.204, green: 0.847, blue: 0.651)   // #34D8A6

    var body: some View {
        let s = entry.snapshot
        VStack(alignment: .leading, spacing: 6) {
            Text("LOCATEFLOW · YOUR MOVE")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(accent)
            Text(s.countdownHeadline)
                .font(.system(size: 22, weight: .heavy))
                .foregroundColor(textColor)
                .lineLimit(1)
            Text(s.nextLine)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(dim)
                .lineLimit(2)
            Spacer(minLength: 0)
            if s.hasPlan {
                HStack {
                    Text("Readiness")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(dim)
                    Spacer()
                    Text("\(s.readinessPercent)%")
                        .font(.system(size: 15, weight: .heavy))
                        .foregroundColor(s.readinessPercent >= 100 ? success : accent)
                }
            } else {
                Text("Tap to open LocateFlow")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(accent)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(bg)
        // Deep-link into the app when tapped.
        .widgetURL(URL(string: "locateflow://"))
    }
}

// MARK: - Widget

@main
struct MoveWidget: Widget {
    let kind = "MoveWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MoveProvider()) { entry in
            MoveWidgetView(entry: entry)
        }
        .configurationDisplayName("LocateFlow Move")
        .description("Your move countdown, next task, and readiness at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
