function cleanText(value) {
  return String(value ?? "").replace(/[^\x20-\x7e]/g, "?");
}

function wrap(value, width = 88) {
  const words = cleanText(value).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function reportLines(analysis) {
  const { user, repos, languageDistribution, scores } = analysis;
  const lines = [
    "REPOSCOPE - DEVELOPER DNA REPORT",
    `Generated: ${new Date().toLocaleDateString("en-US")}`,
    "",
    "DEVELOPER PROFILE",
    `Name: ${user.name || user.login}`,
    `Username: @${user.login}`,
    `Public profile: ${user.html_url}`,
    `Bio: ${user.bio || "Not provided"}`,
    `Followers: ${user.followers} | Following: ${user.following}`,
    `Public repositories on profile: ${user.public_repos}`,
    `Account created: ${user.created_at ? new Date(user.created_at).toLocaleDateString("en-US") : "Unavailable"}`,
    "",
    "TECHNICAL IDENTITY",
    `Most common detected language: ${analysis.dominantLanguage?.language || "Unavailable"}`,
    `Distinct detected languages: ${languageDistribution.length}`,
    ...languageDistribution.map(item => `${item.language}: ${item.count} repositories (${item.percent.toFixed(1)}%)`),
    "",
    "REPOSITORY PORTFOLIO",
    `Repositories analyzed: ${repos.length}`,
    `Original repositories: ${analysis.originalRepos.length}`,
    `Forked repositories: ${analysis.forkedRepos.length}`,
    `Stars received: ${analysis.totalStars}`,
    `Forks received: ${analysis.totalForks}`,
    `Recently created (90 days): ${analysis.recentCreatedCount}`,
    `Recently updated (30 days): ${analysis.recentlyUpdatedCount}`,
    `Most popular repository: ${analysis.mostPopularRepository?.name || "Unavailable"} (${analysis.mostPopularRepository?.stargazers_count || 0} stars)`,
    ...analysis.recentRepos.map(repo => `Recently updated: ${repo.name} (${repo.updated_at ? new Date(repo.updated_at).toLocaleDateString("en-US") : "date unavailable"})`),
    "",
    "BEHAVIOUR INDICATORS",
    `Public activity data: ${analysis.eventsAvailable ? `${analysis.events.length} recent events returned` : "Unavailable"}`,
    ...Object.entries(scores).flatMap(([name, result]) => [
      `${name}: ${result.value === null ? "Insufficient public data" : `${result.value}/100`}`,
      `Method: ${result.formula}`,
      ...result.evidence.map(item => `Evidence: ${item}`)
    ]),
    "",
    "EVIDENCE-BASED OBSERVATIONS",
    ...(analysis.insights.length ? analysis.insights : ["No observations could be generated from the available public data."]),
    "",
    "OBSERVABLE PATTERNS",
    ...(analysis.classifications.length ? analysis.classifications.map(item => `${item.name}: ${item.evidence}`) : ["No patterns met the documented thresholds."]),
    "",
    "DATA LIMITATIONS",
    ...analysis.limitations,
    "",
    "Scores are heuristic indicators based only on the listed public GitHub data. They are not official GitHub scores, productivity measures, or assessments of skill or personality."
  ];

  return lines.flatMap(line => line ? wrap(line) : [""]);
}

function buildPdf(lines) {
  const pages = [];
  for (let index = 0; index < lines.length; index += 48) pages.push(lines.slice(index, index + 48));
  const objects = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pages.forEach((pageLines, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const commands = ["BT", "/F1 9 Tf", "48 744 Td", "13 TL"];
    pageLines.forEach(line => {
      const escaped = cleanText(line).replace(/([\\()])/g, "\\$1");
      commands.push(`(${escaped}) Tj`, "T*");
    });
    commands.push("ET");
    const stream = commands.join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = output.length;
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    output += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return output;
}

export function downloadDeveloperReport(analysis) {
  const pdf = buildPdf(reportLines(analysis));
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reposcope-developer-dna-${analysis.user.login}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
