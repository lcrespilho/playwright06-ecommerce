import { job } from './job'

// free-tier GCP supports a maximum of 2 instances
// GCP e2-medium with 2 vCPUs and 4GB-RAM supports ~8 instances (maximum)
const CONCURRENCY = 2
export const USERBASE = 20 // number of users
export const CHURNPROBABILITY = 0 // User churn chance
export const NAVIGATIONSKIPTHRESHOLD = 0.0 // Chance to drop navigation between steps
export const GRANTCONSENTPROBABILITY = 1 // Probability to accept cookie consent
export const FIREBASEDBNAMESPACE = 'ecommerce04'
export const HEADLESS = process.env.HEADLESS !== 'false'
export const DEVTOOLS = process.env.DEVTOOLS === 'true'
export const LOG = process.env.LOG === 'true'

let activeJobs = 0
async function startNewJob() {
  activeJobs++
  LOG && console.log('\nNew job')
  await job()
  activeJobs--
}

setInterval(() => {
  while (activeJobs < CONCURRENCY) {
    startNewJob()
  }
}, 5000)
