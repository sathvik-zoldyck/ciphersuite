import type { ToolType } from "@/lib/types";

// ─── XML Parsers using native DOMParser ───────────────────────────────────────

/**
 * Extracts essential data from Nmap XML output to fit within LLM context limits.
 * Extract: hosts (IP, hostname, status), open ports (port number, protocol, service name, version), OS detection if present.
 */
function parseNmapXML(doc: Document): string {
  const hosts = Array.from(doc.getElementsByTagName("host"));
  if (hosts.length === 0) return "No hosts found in Nmap XML.";

  const results: string[] = [];

  hosts.forEach(host => {
    const statusTag = host.getElementsByTagName("status")[0];
    const status = statusTag?.getAttribute("state") ?? "unknown";
    
    // Only process hosts that are up
    if (status !== "up") return;

    const addresses = Array.from(host.getElementsByTagName("address"))
      .map(a => a.getAttribute("addr"))
      .filter(Boolean);
      
    const hostnames = Array.from(host.getElementsByTagName("hostname"))
      .map(h => h.getAttribute("name"))
      .filter(Boolean);
    
    // OS Detection
    const osMatches = Array.from(host.getElementsByTagName("osmatch"))
      .map(os => `${os.getAttribute("name")} (${os.getAttribute("accuracy")}%)`);
    
    const targetId = hostnames.length > 0 ? hostnames.join(", ") : (addresses[0] ?? "Unknown Host");

    const ports = Array.from(host.getElementsByTagName("port"));
    const openPorts = ports.filter(p => {
      const state = p.getElementsByTagName("state")[0];
      return state?.getAttribute("state") === "open";
    });

    // Skip hosts with no open ports to save context
    if (openPorts.length === 0 && osMatches.length === 0) return;

    results.push(`\nHost: ${targetId} (IPs: ${addresses.join(", ")}) [Status: ${status}]`);
    
    if (osMatches.length > 0) {
      results.push(`OS Detection: ${osMatches.join(" | ")}`);
    }

    openPorts.forEach(port => {
      const portId = port.getAttribute("portid");
      const proto = port.getAttribute("protocol") ?? "tcp";
      
      const service = port.getElementsByTagName("service")[0];
      const serviceName = service?.getAttribute("name") ?? "unknown";
      const product = service?.getAttribute("product") ?? "";
      const version = service?.getAttribute("version") ?? "";
      
      let portStr = `- Port ${portId}/${proto}: Service: ${serviceName} | Product: ${product} | Version: ${version}`.trim();

      const scripts = Array.from(port.getElementsByTagName("script"));
      scripts.forEach(script => {
        const scriptId = script.getAttribute("id");
        const output = script.getAttribute("output") ?? "";
        const conciseOutput = output.split(/\r?\n/).slice(0, 3).join(" ").substring(0, 150);
        portStr += `\n  * Script: ${scriptId} -> ${conciseOutput}`;
      });

      results.push(portStr);
    });
  });

  return results.length > 0 ? results.join("\n") : "Scanned hosts successfully but no open ports or OS info found.";
}

/**
 * Extracts essential data from Nessus XML output (.nessus).
 * Extract: each ReportItem with pluginName, severity (0-4 scale, convert to Critical/High/Medium/Low/Info), description, solution, cvss_base_score, cve list, host. 
 * Cap at 50 items.
 */
function parseNessusXML(doc: Document): string {
  const reportHosts = Array.from(doc.getElementsByTagName("ReportHost"));
  if (reportHosts.length === 0) return "No ReportHosts found in Nessus XML.";

  const results: string[] = [];
  let itemCount = 0;
  const MAX_ITEMS = 50;

  const severityMap: Record<string, string> = {
    "0": "Informational",
    "1": "Low",
    "2": "Medium",
    "3": "High",
    "4": "Critical"
  };

  // Pre-gather all ReportItems to prioritize higher severities
  const allItems: { host: string; element: Element; sevValue: number }[] = [];
  reportHosts.forEach(host => {
    const hostName = host.getAttribute("name") ?? "Unknown Host";
    const reportItems = Array.from(host.getElementsByTagName("ReportItem"));
    reportItems.forEach(item => {
      const sevStr = item.getAttribute("severity") ?? "0";
      allItems.push({ host: hostName, element: item, sevValue: parseInt(sevStr, 10) });
    });
  });

  // Sort by severity descending to ensure we get the most critical 50 items
  allItems.sort((a, b) => b.sevValue - a.sevValue);

  for (const itemObj of allItems) {
    if (itemCount >= MAX_ITEMS) break;

    const hostName = itemObj.host;
    const item = itemObj.element;
    
    // Ignore pure informational unless we have very few findings
    if (itemObj.sevValue === 0 && allItems.length > 50) continue;

    const pluginName = item.getAttribute("pluginName") ?? "Unknown Issue";
    const severityStr = item.getAttribute("severity") ?? "0";
    const severityMapped = severityMap[severityStr] ?? "Informational";

    const description = item.getElementsByTagName("description")[0]?.textContent ?? "";
    const solution = item.getElementsByTagName("solution")[0]?.textContent ?? "";
    const cvss = item.getElementsByTagName("cvss_base_score")[0]?.textContent ?? "";
    const cves = Array.from(item.getElementsByTagName("cve")).map(c => c.textContent).filter(Boolean).join(", ");

    const condensedDesc = description.substring(0, 300).replace(/\s+/g, " ");
    const condensedSol = solution.substring(0, 200).replace(/\s+/g, " ");

    results.push(
      `\nReportItem: ${pluginName}\n` +
      `Host: ${hostName}\n` +
      `Severity: ${severityMapped}\n` +
      (cvss ? `CVSS Base Score: ${cvss}\n` : "") +
      (cves ? `CVEs: ${cves}\n` : "") +
      `Description: ${condensedDesc}\n` +
      `Solution: ${condensedSol}`
    );
    itemCount++;
  }

  return results.length > 0 ? results.join("\n") : "Parsed Nessus file but found no significant items.";
}

/**
 * Extracts essential data from Burp Suite XML output.
 * Extract: each issue with name, severity, confidence, host, path, issueDetail, remediationDetail. 
 * Cap at 50 items.
 */
function parseBurpXML(doc: Document): string {
  const issues = Array.from(doc.getElementsByTagName("issue"));
  if (issues.length === 0) return "No issues found in Burp XML.";

  const results: string[] = [];
  let itemCount = 0;
  const MAX_ITEMS = 50;

  for (const issue of issues) {
    if (itemCount >= MAX_ITEMS) break;

    const name = issue.getElementsByTagName("name")[0]?.textContent ?? "Unknown Vulnerability";
    const severity = issue.getElementsByTagName("severity")[0]?.textContent ?? "Information";
    const confidence = issue.getElementsByTagName("confidence")[0]?.textContent ?? "Certain";
    
    const hostTag = issue.getElementsByTagName("host")[0];
    const host = hostTag?.textContent ?? "Unknown Host";
    const path = issue.getElementsByTagName("path")[0]?.textContent ?? "";
    
    const issueDetail = issue.getElementsByTagName("issueDetail")[0]?.textContent ?? "";
    const remediationDetail = issue.getElementsByTagName("remediationDetail")[0]?.textContent ?? "";

    // Remove HTML tags and condense
    const cleanDetail = issueDetail.replace(/<[^>]+>/g, " ").substring(0, 300).replace(/\s+/g, " ");
    const cleanRemediation = remediationDetail.replace(/<[^>]+>/g, " ").substring(0, 200).replace(/\s+/g, " ");
    
    results.push(
      `\nIssue: ${name}\n` +
      `Severity: ${severity}\n` +
      `Confidence: ${confidence}\n` +
      `Host: ${host}\n` +
      `Path: ${path}\n` +
      `Details: ${cleanDetail}\n` +
      `Remediation: ${cleanRemediation}`
    );

    itemCount++;
  }

  return results.length > 0 ? results.join("\n") : "Parsed Burp file but couldn't extract issue details.";
}

/**
 * Main entry point: Parses XML strings and condenses them into a format 
 * suitable for the `aiAnalyzeToolOutput` LLM prompt.
 */
export function summarizeXMLOutput(toolType: ToolType, rawContent: string): string {
  if (typeof window === "undefined") {
    throw new Error("summarizeXMLOutput must be called on the client side.");
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawContent, "application/xml");

    // Check for parse errors
    const parseError = doc.getElementsByTagName("parsererror");
    if (parseError.length > 0) {
      console.warn("XML Parsing Error:", parseError[0].textContent);
      // Even if warning, sometimes invalid prefixes break parser but we want to fail gracefully
    }

    switch (toolType) {
      case "Nmap":
        return parseNmapXML(doc);
      case "Nessus":
        return parseNessusXML(doc);
      case "Burp Suite":
        return parseBurpXML(doc);
      default:
        // Generic/Other — return first 8000 characters of raw text as-is.
        return rawContent.substring(0, 8000);
    }
  } catch (error: any) {
    console.warn(`Failed to parse ${toolType} XML natively. Falling back to raw text.`, error);
    // Generic/Other / Fallback — return first 8000 characters of raw text as-is.
    return rawContent.substring(0, 8000);
  }
}
