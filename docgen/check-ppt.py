# PPT 边界与重叠检查：解析 pptx 内所有形状的 bbox，标记越界与文本溢出风险
import sys
from pptx import Presentation
from pptx.util import Emu

path = sys.argv[1]
prs = Presentation(path)
W = prs.slide_width / 914400
H = prs.slide_height / 914400
print(f"canvas: {W:.2f} x {H:.2f} in, slides: {len(prs.slides)}")

SAFE = 0.30  # 最小安全边距（含页码/来源行区域）
issues = []

for idx, slide in enumerate(prs.slides, 1):
    for sh in slide.shapes:
        if sh.left is None:
            continue
        x, y = sh.left / 914400, sh.top / 914400
        w, h = (sh.width or 0) / 914400, (sh.height or 0) / 914400
        r, b = x + w, y + h
        name = (sh.text_frame.text[:18].replace("\n", " ") if sh.has_text_frame and sh.text_frame.text else sh.shape_type)
        if r > W - 0.05 or b > H - 0.05:
            issues.append(f"slide {idx}: OVERFLOW [{name}] right={r:.2f} bottom={b:.2f}")
        elif r > W - SAFE or b > H - SAFE:
            # 仅提示（页码与来源行本就贴近边缘）
            if not (sh.has_text_frame and sh.text_frame.text.strip().isdigit()):
                issues.append(f"slide {idx}: near-edge [{name}] right={r:.2f} bottom={b:.2f}")
    # 文本溢出粗查：字号 × 行数 vs 框高
    for sh in slide.shapes:
        if not sh.has_text_frame or not sh.text_frame.text.strip():
            continue
        txt = sh.text_frame.text
        h_in = (sh.height or 0) / 914400
        # 估算：CJK 每行约 (框宽 - 0.2) / (字号pt/72) 字符，行高 = 字号 × 1.5
        sizes = [r.font.size.pt for p in sh.text_frame.paragraphs for r in p.runs if r.font.size]
        fs = max(sizes) if sizes else 14
        chars_per_line = max(1, ((sh.width or 0) / 914400 - 0.2) / (fs / 72))
        lines = sum(max(1, int(len(p.text) / chars_per_line) + 1) for p in sh.text_frame.paragraphs)
        need = lines * fs * 1.5 / 72
        if need > h_in + 0.25:
            issues.append(f"slide {idx}: TEXT-TIGHT [{txt[:16]}] need~{need:.2f} have {h_in:.2f}")

if issues:
    print("\n".join(issues))
else:
    print("no issues")
