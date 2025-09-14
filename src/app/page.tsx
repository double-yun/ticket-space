'use client'

// 커스텀 인증 사용
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Stack,
  Card,
  CardContent,
  Chip,
  IconButton,
  AppBar,
  Toolbar,
  Avatar,
  Grid,
  Divider,
  CircularProgress,
} from '@mui/material'
import {
  AccountBalanceWallet,
  Logout,
  ShoppingCart,
  Receipt,
  History,
} from '@mui/icons-material'

interface TicketData {
  id: string
  name: string
  description: string
  price: string
  maxSupply: number
  currentSupply: number
  imageUrl?: string
  isActive: boolean
}

interface BalanceData {
  success: boolean
  address?: string
  ethBalance?: string
  nftBalance?: string
  totalSupply?: string
  error?: string
}

export default function Home() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [funding, setFunding] = useState(false)

  useEffect(() => {
    // 세션 확인
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setSession({ user: data.user })
        } else {
          router.push('/login')
        }
      })
  }, [router])

  useEffect(() => {
    if (session) {
      fetchTickets()
      fetchBalance()
    }
  }, [session])

  const fetchTickets = async () => {
    try {
      const response = await fetch('/api/tickets')
      const data = await response.json()
      setTickets(data.tickets || [])
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBalance = async () => {
    if (!session?.user?.walletAddress) return

    try {
      const response = await fetch(`/api/balance?address=${session.user.walletAddress}`)
      const data = await response.json()
      setBalance(data)
    } catch (error) {
      console.error('Error fetching balance:', error)
    }
  }

  const handlePurchase = async (ticketId: string) => {
    if (purchasing) return

    setPurchasing(ticketId)

    try {
      const response = await fetch('/api/tickets/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticketId }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`🎉 구매 성공!\n토큰 ID: ${data.purchase.tokenId}\n트랜잭션: ${data.purchase.transactionHash.slice(0, 10)}...`)

        // 데이터 새로고침
        fetchTickets()
        fetchBalance()
      } else {
        alert(`❌ 구매 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('Purchase error:', error)
      alert('❌ 구매 중 오류가 발생했습니다.')
    } finally {
      setPurchasing(null)
    }
  }

  const handleFundWallet = async () => {
    if (funding) return

    setFunding(true)

    try {
      const response = await fetch('/api/wallet/fund', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        if (data.alreadyFunded) {
          alert(`💰 이미 충분한 잔액이 있습니다!\n현재 잔액: ${data.balance} ETH`)
        } else {
          alert(`🎉 충전 완료!\n${data.amount} ETH가 지갑에 추가되었습니다!\n새 잔액: ${data.newBalance} ETH`)
        }

        // 잔액 새로고침
        fetchBalance()
      } else {
        alert(`❌ 충전 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('Fund wallet error:', error)
      alert('❌ 충전 중 오류가 발생했습니다.')
    } finally {
      setFunding(false)
    }
  }

  if (loading && !session) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!session) {
    return null
  }

  return (
    <>
      {/* 상단 앱바 */}
      <AppBar position="sticky" elevation={1}>
        <Toolbar>
          <Box display="flex" alignItems="center" flexGrow={1}>
            <Typography variant="h6" component="h1" fontWeight="bold">
              🎫 티켓팅
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar sx={{ width: 32, height: 32 }}>
              {session.user?.name?.charAt(0)}
            </Avatar>
            <IconButton
              color="inherit"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' })
                router.push('/login')
              }}
            >
              <Logout />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 2 }}>
        {/* 사용자 지갑 정보 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={2}>
              <AccountBalanceWallet color="primary" />
              <Box flexGrow={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  내 지갑
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {session.user?.walletAddress?.slice(0, 6)}...{session.user?.walletAddress?.slice(-4)}
                </Typography>
              </Box>
              {balance && (
                <Box textAlign="right">
                  <Typography variant="h6" color="primary.main">
                    {balance.ethBalance} ETH
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    NFT: {balance.nftBalance}개
                  </Typography>
                  {parseFloat(balance.ethBalance) < 0.1 && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      onClick={handleFundWallet}
                      disabled={funding}
                      sx={{ mt: 0.5, fontSize: '0.7rem' }}
                    >
                      {funding ? '충전 중...' : '💰 충전'}
                    </Button>
                  )}
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* 티켓 목록 */}
        <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 2 }}>
          🎪 이용 가능한 티켓
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {tickets.map((ticket) => (
              <Card key={ticket.id} elevation={2}>
                <CardContent>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={1}>
                      <Typography variant="h4">
                        {ticket.name.includes('일반') ? '🎪' :
                         ticket.name.includes('VIP') ? '⭐' : '🎯'}
                      </Typography>
                    </Grid>
                    <Grid item xs={7}>
                      <Typography variant="h6" fontWeight="bold">
                        {ticket.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {ticket.description}
                      </Typography>
                      <Chip
                        label={`${ticket.currentSupply}/${ticket.maxSupply} 판매됨`}
                        size="small"
                        color={ticket.currentSupply >= ticket.maxSupply ? "error" : "default"}
                      />
                    </Grid>
                    <Grid item xs={4} textAlign="right">
                      <Typography variant="h6" color="primary.main" fontWeight="bold">
                        {parseFloat(ticket.price) / 1e18} ETH
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        fullWidth
                        disabled={ticket.currentSupply >= ticket.maxSupply || purchasing === ticket.id}
                        startIcon={purchasing === ticket.id ? <CircularProgress size={16} /> : <ShoppingCart />}
                        onClick={() => handlePurchase(ticket.id)}
                        sx={{ mt: 1 }}
                      >
                        {purchasing === ticket.id ? '구매 중...' : '구매'}
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        {/* 하단 네비게이션 */}
        <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, p: 2, bgcolor: 'background.paper' }}>
          <Stack direction="row" spacing={1}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Receipt />}
              onClick={() => router.push('/my-tickets')}
            >
              내 티켓
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<History />}
              onClick={() => router.push('/transactions')}
            >
              거래 내역
            </Button>
          </Stack>
        </Box>
      </Container>
    </>
  )
}