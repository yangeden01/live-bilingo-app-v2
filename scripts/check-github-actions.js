import https from 'https';
import fs from 'fs';

let token = process.env.GITHUB_TOKEN;
let repo = process.env.GITHUB_REPO || 'yangeden01/live-bilingo-app-v2';

if (!token && fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const tokenMatch = envContent.match(/GITHUB_TOKEN=([^\r\n]+)/);
  if (tokenMatch) token = tokenMatch[1].trim();
  const repoMatch = envContent.match(/GITHUB_REPO=([^\r\n]+)/);
  if (repoMatch) repo = repoMatch[1].trim();
}

function githubRequest(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: urlPath,
      method: 'GET',
      headers: {
        'User-Agent': 'LiveBilingo-ActionsWatcher',
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function checkLatestRun() {
  const runsRes = await githubRequest(`/repos/${repo}/actions/runs?per_page=5`);
  if (runsRes.status !== 200) {
    console.error(`Failed to fetch workflow runs: HTTP ${runsRes.status}`, runsRes.data);
    return null;
  }

  const runs = runsRes.data.workflow_runs || [];
  if (runs.length === 0) {
    console.log('No workflow runs found.');
    return null;
  }

  const latest = runs[0];
  console.log(`\n======================================================`);
  console.log(`📦 Latest Run #${latest.run_number} (${latest.name})`);
  console.log(`Commit: ${latest.head_commit?.id?.slice(0, 7)} - ${latest.head_commit?.message}`);
  console.log(`Status: ${latest.status.toUpperCase()} | Result: ${(latest.conclusion || 'RUNNING...').toUpperCase()}`);
  console.log(`Workflow URL: ${latest.html_url}`);
  console.log(`======================================================`);

  const jobsRes = await githubRequest(`/repos/${repo}/actions/runs/${latest.id}/jobs`);
  if (jobsRes.status === 200 && jobsRes.data.jobs) {
    for (const job of jobsRes.data.jobs) {
      const icon = job.conclusion === 'success' ? '✅' : job.conclusion === 'failure' ? '❌' : '⏳';
      console.log(`  ${icon} Job: ${job.name} [${job.status} / ${job.conclusion || 'running'}]`);
      if (job.steps) {
        for (const step of job.steps) {
          if (step.conclusion === 'failure') {
            console.log(`     ❌ FAILED Step: ${step.name} (Step #${step.number})`);
          } else if (step.status === 'in_progress') {
            console.log(`     ⏳ Running Step: ${step.name}...`);
          }
        }
      }
    }
  }

  return latest;
}

const isWatch = process.argv.includes('--watch');

async function main() {
  if (!isWatch) {
    await checkLatestRun();
    return;
  }

  console.log(`👀 Watching GitHub Actions runs in real-time... (Press Ctrl+C to stop)`);
  let prevStatus = '';
  while (true) {
    const run = await checkLatestRun();
    if (run && (run.status === 'completed')) {
      console.log(`\n🏁 Workflow run #${run.run_number} completed with conclusion: ${run.conclusion}`);
      break;
    }
    await new Promise(r => setTimeout(r, 8000));
  }
}

main().catch(console.error);
