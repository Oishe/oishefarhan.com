# Figure pipeline (§8). Sources live in vault/figures/, generated output in
# vault/attachments/figs/ — and the generated output is COMMITTED, so neither
# Quartz nor Cloudflare ever needs LaTeX, Typst, or manim installed.
#
# Run via `just figures`.

FIGS := vault/attachments/figs
SRC  := vault/figures

.PHONY: all
all: $(patsubst $(SRC)/%.typ,$(FIGS)/%.svg,$(wildcard $(SRC)/*.typ)) \
     $(patsubst $(SRC)/%.d2,$(FIGS)/%.svg,$(wildcard $(SRC)/*.d2)) \
     $(patsubst $(SRC)/%.tex,$(FIGS)/%.svg,$(wildcard $(SRC)/*.tex)) \
     $(patsubst $(SRC)/%.py,$(FIGS)/%.mp4,$(wildcard $(SRC)/*.py))

$(FIGS)/%.svg: $(SRC)/%.typ
	typst compile $< $@

$(FIGS)/%.svg: $(SRC)/%.d2
	d2 $< $@

# CircuiTikZ. Nothing else is close for ECE schematics.
$(FIGS)/%.svg: $(SRC)/%.tex
	latexmk -pdf -outdir=$(dir $@) $<
	pdf2svg $(@:.svg=.pdf) $@

# manim. MP4/H.264 only — GIF is routinely 10x larger.
$(FIGS)/%.mp4: $(SRC)/%.py
	manim -qh $< --format=mp4 -o $@
