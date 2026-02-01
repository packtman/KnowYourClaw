import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

interface Agent {
  id: string
  name: string
  description?: string
  status: string
  verified_at: string
  capabilities?: string[]
  model_family?: string
  framework?: string
}

interface ClaimInfo {
  agent: Agent
  claim_expires_at: string
  already_claimed: boolean
  owner?: {
    provider: string
    handle: string
  }
}

export default function ClaimPage() {
  const { token } = useParams<{ token: string }>()
  const [claimInfo, setClaimInfo] = useState<ClaimInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)

  const API_BASE = import.meta.env.VITE_API_URL || ''

  useEffect(() => {
    async function fetchClaimInfo() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/claim/${token}`)
        const data = await res.json()
        
        if (!res.ok) {
          setError(data.error || 'Invalid or expired claim link')
          return
        }
        
        setClaimInfo(data)
      } catch (err) {
        setError('Failed to load claim information')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchClaimInfo()
    }
  }, [token, API_BASE])

  const handleTwitterClaim = () => {
    setClaiming(true)
    // Redirect to Twitter OAuth flow
    window.location.href = `${API_BASE}/api/v1/claim/auth/twitter?claim_token=${token}`
  }

  const handleGitHubClaim = () => {
    setClaiming(true)
    // Redirect to GitHub OAuth flow
    window.location.href = `${API_BASE}/api/v1/claim/auth/github?claim_token=${token}`
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading claim information...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-2">Claim Failed</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link 
            to="/" 
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    )
  }

  if (!claimInfo) {
    return null
  }

  const { agent, already_claimed, owner, claim_expires_at } = claimInfo
  const expiresIn = new Date(claim_expires_at).getTime() - Date.now()
  const expiresInHours = Math.max(0, Math.floor(expiresIn / (1000 * 60 * 60)))
  const expiresInDays = Math.floor(expiresInHours / 24)

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Agent Card */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 mb-8">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-4xl">
            🤖
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
              {agent.status === 'verified' && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-sm rounded-full flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified Agent
                </span>
              )}
            </div>
            {agent.description && (
              <p className="text-gray-400 mb-4">{agent.description}</p>
            )}
            <div className="flex flex-wrap gap-2 text-sm">
              {agent.model_family && (
                <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">
                  {agent.model_family}
                </span>
              )}
              {agent.framework && (
                <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">
                  {agent.framework}
                </span>
              )}
              <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">
                Verified {new Date(agent.verified_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Claim Section */}
      {already_claimed && owner ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-white mb-2">Already Claimed</h2>
          <p className="text-gray-400 mb-4">
            This agent has been claimed by{' '}
            <span className="text-white font-medium">
              @{owner.handle}
            </span>{' '}
            via {owner.provider === 'twitter' ? 'X/Twitter' : 'GitHub'}
          </p>
          <Link 
            to={`/a/${encodeURIComponent(agent.name)}`}
            className="text-blue-400 hover:text-blue-300"
          >
            View agent profile →
          </Link>
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8">
          <h2 className="text-xl font-bold text-white mb-2 text-center">
            Claim This Agent
          </h2>
          <p className="text-gray-400 text-center mb-6">
            Prove you own <span className="text-white font-medium">{agent.name}</span> by 
            authenticating with your X/Twitter or GitHub account. This links your 
            identity to the agent and increases trust.
          </p>

          {/* Why Claim? */}
          <div className="bg-gray-900/50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Why claim your agent?</h3>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Show platforms and users who operates this agent</li>
              <li>• Build trust with a verified human owner</li>
              <li>• Prevent impersonation of your agent</li>
              <li>• Required by some platforms for full access</li>
            </ul>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleTwitterClaim}
              disabled={claiming}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-black hover:bg-gray-900 border border-gray-600 rounded-xl text-white font-medium transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              {claiming ? 'Redirecting...' : 'Claim with X / Twitter'}
            </button>
            
            <button
              onClick={handleGitHubClaim}
              disabled={claiming}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-medium transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              {claiming ? 'Redirecting...' : 'Claim with GitHub'}
            </button>
          </div>

          {/* Expiry Warning */}
          <p className="text-center text-sm text-gray-500 mt-6">
            This claim link expires in{' '}
            <span className="text-yellow-400">
              {expiresInDays > 0 ? `${expiresInDays} days` : `${expiresInHours} hours`}
            </span>
          </p>
        </div>
      )}

      {/* Security Note */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          AgentDMV uses OAuth for secure authentication.
          We only access your public profile information.
        </p>
      </div>
    </div>
  )
}
