const { Octokit } = require("@octokit/core");
const {sortBy, mean, min, max} = require('lodash');
require('dotenv').config();

const token = process.env.GITHUB_TOKEN
const repo = process.env.REPO
const csvPath = process.env.CSV_PATH

if (!token) {
    throw new Error('GITHUB_TOKEN missing: Need a GitHub token (e.g. personal access token)')
}

if (!repo) {
    throw new Error('REPO missing: Need a GitHub repo (e.g. sourcegraph/handbook)')
}

const octokit = new Octokit({ auth: token });

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

// PR ordinals to measure (1-indexed)
const pullRequestOrdinals = [1, 2, 10];

function getOrdinals(array, ordinals) {
    return ordinals.map(index => array[index - 1]).filter(Boolean)
}

async function getStatsForAuthor(author) {
    if (!author) {
        throw new Error('No author given')
    }
    const result = await octokit.request('GET /search/issues', {
        q: `repo:${repo} author:${author.githubUsername} is:pr is:merged`,
        sort: 'created',
        order: 'asc',
        per_page: 100
    })

    const sortedPrs = sortBy(result.data.items, item => parseDate(item.pull_request.merged_at))

    const pickedPrs = getOrdinals(sortedPrs, pullRequestOrdinals)

    return pickedPrs.map(pr => parseDate(pr.pull_request.merged_at) - parseDate(author.hireDate));
}



const users = [
    {
        githubUsername: 'marekweb',
        hireDate: '2020-05-11'
    },
    {
        githubUsername: 'rafax',
        hireDate: '2021-10-14'
    },
    {
        githubUsername: 'marybelzer',
        hireDate: '2021-08-23'
    }
]
async function run() {
    const series = pullRequestOrdinals.map(() => [])
    for (const user of users) {
        const stats = await getStatsForAuthor(user, repo);

        console.log(`${user.githubUsername}\t${stats.join('\t')}`)
        stats.forEach((stat, i) => {
            series[i].push(stat);
        })
    }
    console.log(series);
    const stats = series.map(s => ({
        mean: mean(s),
        min: min(s),
        max: max(s),
        median: medianish(s)
        // TODO: add mode
    }))

    pullRequestOrdinals.forEach((ordinal, i) => {
        const {mean, min, max, median} = stats[i]
        console.log(`Time to PR #${ordinal}\n\tmean: ${mean.toFixed(2)}\n\tmin: ${min}\n\tmax: ${max}\n\tmedian: ${median.toFixed(2)}`)
    })
}

function medianish(array) {
    return array.sort()[Math.floor(array.length / 2)]
}

function parseDate(date) {
    const [datePart] = date.split('T')
    return new Date(datePart) / DAY_IN_MILLISECONDS
}


run()