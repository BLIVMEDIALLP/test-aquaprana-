'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function SplashPage() {
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Check if profile is complete
        const { data: profile } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single()
        router.replace(profile ? '/home' : '/auth/profile')
      } else {
        router.replace('/auth/phone')
      }
    }
    const timer = setTimeout(check, 1800)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-ap-blue px-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-4 mb-auto mt-auto">
        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-lg">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" fill="#E8F4FD"/>
            <path d="M24 8C24 8 14 18 14 26C14 31.5 18.5 36 24 36C29.5 36 34 31.5 34 26C34 18 24 8 24 8Z" fill="#1E7AB8"/>
            <path d="M20 28C21.5 30 22.5 31 24 31C25.5 31 26.5 30 28 28" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight">AquaPrana</h1>
          <p className="text-ap-blue-light text-base mt-1 opacity-90">Life force for your ponds</p>
        </div>
      </div>

      {/* Loading indicator */}
      <div className="mb-16 flex gap-1.5">
        <div className="w-1.5 h-1.5 bg-white rounded-full opacity-60 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 bg-white rounded-full opacity-60 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 bg-white rounded-full opacity-60 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>

      <p className="absolute bottom-8 text-white/40 text-xs">AQUA AI Pvt Ltd</p>
    </div>
  )
}
