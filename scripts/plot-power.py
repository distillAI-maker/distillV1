"""Plot the recorded Monte Carlo results; never recalculate or invent data."""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parent.parent
report = json.loads((root / "data/power-results.json").read_text(encoding="utf-8"))
fig, ax = plt.subplots(figsize=(10, 6), layout="constrained")
for scenario, color in [("14d-normal", "#64748b"), ("28d-normal", "#d97706"), ("28d-2d", "#0f766e"), ("42d-3d-reference", "#1d4ed8"), ("42d-carryover", "#7c3aed")]:
    cells = sorted((c for c in report["cells"] if c["scenario"]["id"] == scenario), key=lambda c: c["effect"])
    x = [c["effect"] for c in cells]
    y = [100 * c["decisive"]["value"] for c in cells]
    bounds = [c["decisive"]["interval95"] for c in cells]
    ax.plot(x, y, "o-", label=cells[0]["scenario"]["label"], linewidth=1.7, markersize=4, color=color)
    ax.fill_between(x, [100*b[0] for b in bounds], [100*b[1] for b in bounds], alpha=.08, color=color)
ax.axhline(100/3, color="#64748b", linestyle=":", linewidth=1, label="One in three")
ax.axhline(50, color="#64748b", linestyle="--", linewidth=1, label="One in two")
ax.set(xlabel="Injected beneficial effect (person's stationary standard deviations)", ylabel="Decisive verdict / all attempted experiments (%)", ylim=(-2, 102), xlim=(-.02, 2.02), title="Distill: synthetic power by schedule\nShading shows Monte Carlo 95% Wilson intervals")
ax.grid(alpha=.18)
ax.legend(loc="upper left", fontsize=8)
fig.text(.995, -.018, f"Seed {report['metadata']['seed']} · Synthetic model; not a real-user prediction", ha="right", fontsize=8, color="#475569")
(root / "docs/assets").mkdir(parents=True, exist_ok=True)
fig.savefig(root / "docs/assets/power.png", dpi=170, bbox_inches="tight")
fig.savefig(root / "docs/assets/power.svg", bbox_inches="tight")
svg_path = root / "docs/assets/power.svg"
svg_path.write_text("\n".join(line.rstrip() for line in svg_path.read_text(encoding="utf-8").splitlines()) + "\n", encoding="utf-8")
print("Wrote docs/assets/power.png and power.svg")
