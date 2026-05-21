import { job } from './job'

// free-tier GCP supports a maximum of 2 instances
// GCP e2-medium with 2 vCPUs and 4GB-RAM supports ~8 instances (maximum)
const CONCURRENCY = 2
export const USERBASE = 100 // number of users
export const CHURNPROBABILITY = 0.25 // User churn chance
export const NAVIGATIONSKIPTHRESHOLD = 0.1 // Chance to drop navigation between steps
export const FIREBASEDBNAMESPACE = 'ecommerce02'

let activeJobs = 0
async function startNewJob() {
  activeJobs++
  // process.stdout.write('.') // work indicator
  await job()
  activeJobs--
}

setInterval(() => {
  while (activeJobs < CONCURRENCY) {
    startNewJob()
  }
}, 5000)
