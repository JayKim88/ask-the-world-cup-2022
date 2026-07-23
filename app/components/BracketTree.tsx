"use client";

// D3 tournament bracket (PRD §6 — signature visualization). The layout geometry
// is pure (lib/bracket/layout); D3 owns the SVG subtree here: elbow connectors,
// match boxes with the winner emphasized, a hover highlight, a native <title>
// for detail, and a staggered fade-in. Rendered into a ref so React manages the
// container and D3 manages the drawing.

import { useEffect, useRef } from "react";
import * as d3 from "d3";

import { layoutBracket, type PositionedMatch } from "@/lib/bracket/layout";
import type { BracketMatch } from "@/lib/bracket/query";

const BOX_WIDTH = 184;
const BOX_HEIGHT = 52;
const BOX_RADIUS = 6;
const MARGIN = { top: 40, right: 20, bottom: 20, left: 20 };
const WINNER_COLOR = "#10b981"; // green — legible on light and dark
const COLUMN_LABELS = ["16강", "8강", "4강", "결승"];
const ENTER_STAGGER_MS = 120;
const ENTER_DURATION_MS = 400;
const FONT = { team: 12, score: 11, round: 13 };
const WEIGHT = { winner: 700, normal: 400, label: 600 };
const OPACITY = { link: 0.25, boxIdle: 0.25, boxHover: 0.9, score: 0.6, roundLabel: 0.5 };
const TEXT = { padX: 10, homeY: 20, awayY: 40, scoreY: 30, roundY: -16 };

function elbowPath(source: PositionedMatch, target: PositionedMatch): string {
  const startX = source.x + BOX_WIDTH;
  const endX = target.x;
  const midX = (startX + endX) / 2;
  return `M ${startX},${source.y} H ${midX} V ${target.y} H ${endX}`;
}

function detailOf(match: BracketMatch): string {
  const place = [match.venue, match.city].filter(Boolean).join(", ");
  return `${match.homeTeam} ${match.score} ${match.awayTeam}${place ? ` · ${place}` : ""}`;
}

export function BracketTree({ matches }: { matches: BracketMatch[] }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const layout = layoutBracket(matches);
    const selection = d3.select(svg);
    selection.selectAll("*").remove();
    selection.attr("viewBox", `0 0 ${layout.width + MARGIN.left + MARGIN.right} ${layout.height + MARGIN.top + MARGIN.bottom}`);

    const root = selection.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Round labels across the top.
    root
      .selectAll("text.round")
      .data(COLUMN_LABELS)
      .join("text")
      .attr("class", "round")
      .attr("x", (_, index) => index * (layout.width / COLUMN_LABELS.length))
      .attr("y", TEXT.roundY)
      .attr("fill", "currentColor")
      .attr("opacity", OPACITY.roundLabel)
      .attr("font-size", FONT.round)
      .attr("font-weight", WEIGHT.label)
      .text((label) => label);

    // Connectors.
    root
      .selectAll("path.link")
      .data(layout.links)
      .join("path")
      .attr("class", "link")
      .attr("d", (link) => elbowPath(link.source, link.target))
      .attr("fill", "none")
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", OPACITY.link);

    // Match boxes.
    const node = root
      .selectAll("g.node")
      .data(layout.nodes)
      .join("g")
      .attr("class", "node")
      .attr("transform", (positioned) => `translate(${positioned.x},${positioned.y - BOX_HEIGHT / 2})`)
      .style("cursor", "default");

    node.append("title").text((positioned) => detailOf(positioned.match));

    const box = node
      .append("rect")
      .attr("width", BOX_WIDTH)
      .attr("height", BOX_HEIGHT)
      .attr("rx", BOX_RADIUS)
      .attr("fill", "none")
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", OPACITY.boxIdle);

    const isWinner = (positioned: PositionedMatch, team: string) => positioned.match.winner === team;
    const teamColor = (positioned: PositionedMatch, team: string) => (isWinner(positioned, team) ? WINNER_COLOR : "currentColor");
    const teamWeight = (positioned: PositionedMatch, team: string) => (isWinner(positioned, team) ? WEIGHT.winner : WEIGHT.normal);

    node
      .append("text")
      .attr("x", TEXT.padX)
      .attr("y", TEXT.homeY)
      .attr("font-size", FONT.team)
      .attr("fill", (positioned) => teamColor(positioned, positioned.match.homeTeam))
      .attr("font-weight", (positioned) => teamWeight(positioned, positioned.match.homeTeam))
      .text((positioned) => positioned.match.homeTeam);

    node
      .append("text")
      .attr("x", TEXT.padX)
      .attr("y", TEXT.awayY)
      .attr("font-size", FONT.team)
      .attr("fill", (positioned) => teamColor(positioned, positioned.match.awayTeam))
      .attr("font-weight", (positioned) => teamWeight(positioned, positioned.match.awayTeam))
      .text((positioned) => positioned.match.awayTeam);

    node
      .append("text")
      .attr("x", BOX_WIDTH - TEXT.padX)
      .attr("y", TEXT.scoreY)
      .attr("text-anchor", "end")
      .attr("font-size", FONT.score)
      .attr("fill", "currentColor")
      .attr("opacity", OPACITY.score)
      .text((positioned) => positioned.match.score);

    node
      .on("mouseenter", function () {
        d3.select(this).select("rect").attr("stroke", WINNER_COLOR).attr("stroke-opacity", OPACITY.boxHover);
      })
      .on("mouseleave", function () {
        d3.select(this).select("rect").attr("stroke", "currentColor").attr("stroke-opacity", OPACITY.boxIdle);
      });

    // Staggered fade-in by column.
    node
      .attr("opacity", 0)
      .transition()
      .delay((positioned) => positioned.column * ENTER_STAGGER_MS)
      .duration(ENTER_DURATION_MS)
      .attr("opacity", 1);

    return () => {
      box.interrupt();
    };
  }, [matches]);

  return (
    <div className="overflow-x-auto text-zinc-800 dark:text-zinc-100">
      <svg ref={svgRef} className="min-w-215 max-w-full" role="img" aria-label="2022 월드컵 토너먼트 대진표" />
    </div>
  );
}
