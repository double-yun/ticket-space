'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  Stack,
  Chip,
  IconButton,
  AppBar,
  Toolbar,
  CircularProgress,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material'
import {
  ArrowBack,
  Receipt,
  Launch,
  AccessTime,
  CheckCircle,
} from '@mui/icons-material'

interface Purchase {
  id: string
  transactionHash: string
  tokenId: string
  purchaseDate: string
  used: boolean
  usedAt?: string
  ticket: {
    id: string
    name: string
    description: string
    price: string
    imageUrl?: string
  }
}

export default function TransactionsPage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 세션 확인
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setSession({ user: data.user })
          fetchPurchases()
        } else {
          router.push('/login')
        }
      })
  }, [router])

  const fetchPurchases = async () => {
    try {
      const response = await fetch('/api/purchases')
      const data = await response.json()

      if (data.success) {
        setPurchases(data.purchases)
      }
    } catch (error) {
      console.error('Error fetching purchases:', error)
    } finally {
      setLoading(false)
    }
  }

  const openTransaction = (hash: string) => {
    // 실제로는 블록 익스플로러 링크를 열어야 하지만, Anvil이므로 복사
    navigator.clipboard.writeText(hash)
    alert('트랜잭션 해시가 복사되었습니다!')
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <>
      <AppBar position="sticky" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => router.back()}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" component="h1" fontWeight="bold">
            거래 내역
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 2 }}>
        {purchases.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Receipt sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              거래 내역이 없습니다
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              티켓을 구매하면 거래 내역이 표시됩니다
            </Typography>
            <Button variant="contained" onClick={() => router.push('/')}>
              홈으로 가기
            </Button>
          </Box>
        ) : (
          <Stack spacing={2}>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              전체 거래 ({purchases.length}건)
            </Typography>

            <Card elevation={1}>
              <List>
                {purchases.map((purchase, index) => (
                  <Box key={purchase.id}>
                    <ListItem>
                      <ListItemIcon>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1,
                            bgcolor: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography variant="body2" color="primary.contrastText">
                            #{purchase.tokenId}
                          </Typography>
                        </Box>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {purchase.ticket.name}
                            </Typography>
                            <Chip
                              label="구매"
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                            <Typography variant="body2" color="text.secondary">
                              {parseFloat(purchase.ticket.price) / 1e18} ETH • {new Date(purchase.purchaseDate).toLocaleString('ko-KR')}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="caption" fontFamily="monospace">
                                {purchase.transactionHash.slice(0, 10)}...{purchase.transactionHash.slice(-6)}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => openTransaction(purchase.transactionHash)}
                              >
                                <Launch fontSize="small" />
                              </IconButton>
                            </Box>
                          </Stack>
                        }
                      />
                      <Box textAlign="right">
                        <Chip
                          icon={purchase.used ? <CheckCircle /> : <AccessTime />}
                          label={purchase.used ? '사용완료' : '미사용'}
                          size="small"
                          color={purchase.used ? 'success' : 'default'}
                        />
                      </Box>
                    </ListItem>
                    {index < purchases.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            </Card>
          </Stack>
        )}
      </Container>
    </>
  )
}