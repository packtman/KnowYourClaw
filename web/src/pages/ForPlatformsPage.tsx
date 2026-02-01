import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ArrowRight, Key } from 'lucide-react'

export default function ForPlatformsPage() {
  const [markdown, setMarkdown] = useState<string>('')
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetch('/for-platforms.md')
      .then(res => res.text())
      .then(text => {
        setMarkdown(text)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])
  
  // Simple markdown rendering
  const renderMarkdown = (md: string) => {
    const lines = md.split('\n')
    const elements: React.ReactElement[] = []
    let inCodeBlock = false
    let codeContent = ''
    let inTable = false
    let tableRows: string[][] = []
    let tableKey = 0
    
    const flushTable = () => {
      if (tableRows.length > 0) {
        const headers = tableRows[0]
        const rows = tableRows.slice(2)
        elements.push(
          <div key={`table-${tableKey++}`} className="overflow-x-auto my-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  {headers.map((h, i) => (
                    <th key={i} className="text-left py-2 px-3 text-gray-300 font-semibold">
                      {renderInline(h.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-800">
                    {row.map((cell, j) => (
                      <td key={j} className="py-2 px-3 text-gray-400">
                        {renderInline(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        tableRows = []
      }
      inTable = false
    }
    
    lines.forEach((line, index) => {
      // Code blocks
      if (line.startsWith('```')) {
        if (inTable) flushTable()
        if (!inCodeBlock) {
          inCodeBlock = true
          codeContent = ''
        } else {
          inCodeBlock = false
          elements.push(
            <pre key={`code-${index}`} className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto my-4">
              <code className="text-sm text-gray-300">{codeContent.trim()}</code>
            </pre>
          )
        }
        return
      }
      
      if (inCodeBlock) {
        codeContent += line + '\n'
        return
      }
      
      // Tables
      if (line.startsWith('|')) {
        inTable = true
        const cells = line.split('|').filter(c => c.trim() !== '')
        if (!line.includes('---')) {
          tableRows.push(cells)
        } else {
          tableRows.push([])
        }
        return
      } else if (inTable) {
        flushTable()
      }
      
      // Headers
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={index} className="text-3xl font-bold text-white mt-8 mb-4">
            {line.slice(2)}
          </h1>
        )
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-2xl font-bold text-white mt-10 mb-4 pb-2 border-b border-gray-800">
            {line.slice(3)}
          </h2>
        )
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-xl font-semibold text-white mt-6 mb-3">
            {line.slice(4)}
          </h3>
        )
      }
      // Horizontal rule
      else if (line === '---') {
        elements.push(<hr key={index} className="my-8 border-gray-800" />)
      }
      // List items
      else if (line.startsWith('- ')) {
        elements.push(
          <li key={index} className="text-gray-300 ml-4 my-1">
            {renderInline(line.slice(2))}
          </li>
        )
      }
      // Numbered lists
      else if (/^\d+\.\s/.test(line)) {
        elements.push(
          <li key={index} className="text-gray-300 ml-4 my-1 list-decimal">
            {renderInline(line.replace(/^\d+\.\s/, ''))}
          </li>
        )
      }
      // Paragraphs
      else if (line.trim()) {
        elements.push(
          <p key={index} className="text-gray-300 my-3 leading-relaxed">
            {renderInline(line)}
          </p>
        )
      }
    })
    
    if (inTable) flushTable()
    
    return elements
  }
  
  // Handle inline markdown
  const renderInline = (text: string): React.ReactNode => {
    const parts = text.split(/(`[^`]+`)/g)
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="bg-gray-800 text-indigo-300 px-1.5 py-0.5 rounded text-sm">
            {part.slice(1, -1)}
          </code>
        )
      }
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g)
      return boldParts.map((bp, j) => {
        if (bp.startsWith('**') && bp.endsWith('**')) {
          return <strong key={`${i}-${j}`} className="text-white font-semibold">{bp.slice(2, -2)}</strong>
        }
        const linkMatch = bp.match(/\[([^\]]+)\]\(([^)]+)\)/)
        if (linkMatch) {
          const [full, label, url] = linkMatch
          const before = bp.slice(0, bp.indexOf(full))
          const after = bp.slice(bp.indexOf(full) + full.length)
          return (
            <React.Fragment key={`${i}-${j}`}>
              {before}
              {url.startsWith('/') ? (
                <Link to={url} className="text-indigo-400 hover:text-indigo-300 underline">
                  {label}
                </Link>
              ) : (
                <a href={url} className="text-indigo-400 hover:text-indigo-300 underline" target="_blank" rel="noopener noreferrer">
                  {label}
                </a>
              )}
              {after}
            </React.Fragment>
          )
        }
        return bp
      })
    })
  }
  
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">For Platforms</h1>
        </div>
        <p className="text-gray-400">
          Stop spam agents and build trust. Integration takes minutes.
        </p>
      </div>
      
      {/* CTA */}
      <div className="card p-4 mb-8 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border-indigo-500/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-white font-medium">Ready to get started?</p>
            <p className="text-gray-400 text-sm">Register your platform and get your API key.</p>
          </div>
          <Link to="/platforms/register" className="btn-primary flex items-center gap-2">
            <Key className="w-4 h-4" />
            Get API Key
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
      
      {/* Content */}
      <div className="card p-8">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded w-1/3" />
            <div className="h-4 bg-gray-800 rounded w-full" />
            <div className="h-4 bg-gray-800 rounded w-2/3" />
          </div>
        ) : markdown ? (
          <div className="prose prose-invert max-w-none">
            {renderMarkdown(markdown)}
          </div>
        ) : (
          <p className="text-gray-400">Failed to load content.</p>
        )}
      </div>
    </div>
  )
}
