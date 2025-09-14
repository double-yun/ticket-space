'use client'

import { useState, useEffect, useRef } from 'react'
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
  Avatar,
  CircularProgress,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  ArrowBack,
  ConfirmationNumber,
  AccessTime,
  CheckCircle,
  Cancel,
  QrCode,
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

export default function MyTicketsPage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Purchase | null>(null)
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('')

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

  const handleShowQR = async (purchase: Purchase) => {
    setSelectedTicket(purchase)

    // QR 코드 생성
    try {
      const QRCode = (await import('qrcode')).default

      const ticketData = {
        tokenId: purchase.tokenId,
        ticketName: purchase.ticket.name,
        transactionHash: purchase.transactionHash,
        purchaseDate: purchase.purchaseDate,
        used: purchase.used
      }

      const qrDataURL = await QRCode.toDataURL(JSON.stringify(ticketData), {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      setQrCodeDataURL(qrDataURL)
      setQrDialogOpen(true)
    } catch (error) {
      console.error('QR 코드 생성 실패:', error)
      alert('QR 코드 생성에 실패했습니다.')
    }
  }

  const handleCloseQR = () => {
    setQrDialogOpen(false)
    setSelectedTicket(null)
    setQrCodeDataURL('')
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
            내 티켓
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 2 }}>
        {purchases.length === 0 ? (
          <Box textAlign="center" py={8}>
            <ConfirmationNumber sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              구매한 티켓이 없습니다
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              홈에서 티켓을 구매해보세요!
            </Typography>
            <Button variant="contained" onClick={() => router.push('/')}>
              홈으로 가기
            </Button>
          </Box>
        ) : (
          <Stack spacing={2}>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              보유 티켓 ({purchases.length}개)
            </Typography>

            {purchases.map((purchase) => (
              <Card key={purchase.id} elevation={2}>
                <CardContent>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={1}>
                      <Typography variant="h4">
                        {purchase.ticket.name.includes('일반') ? '🎪' :
                         purchase.ticket.name.includes('VIP') ? '⭐' : '🎯'}
                      </Typography>
                    </Grid>
                    <Grid item xs={7}>
                      <Typography variant="h6" fontWeight="bold">
                        {purchase.ticket.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {purchase.ticket.description}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <Chip
                          icon={<ConfirmationNumber />}
                          label={`토큰 #${purchase.tokenId}`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          icon={purchase.used ? <CheckCircle /> : <AccessTime />}
                          label={purchase.used ? '사용완료' : '미사용'}
                          size="small"
                          color={purchase.used ? 'success' : 'primary'}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        구매일: {new Date(purchase.purchaseDate).toLocaleString('ko-KR')}
                      </Typography>
                    </Grid>
                    <Grid item xs={4} textAlign="right">
                      <Typography variant="h6" color="primary.main" fontWeight="bold">
                        {parseFloat(purchase.ticket.price) / 1e18} ETH
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {purchase.transactionHash.slice(0, 6)}...{purchase.transactionHash.slice(-4)}
                      </Typography>
                      {!purchase.used && (
                        <Stack spacing={1}>
                          <Button
                            variant="contained"
                            size="small"
                            fullWidth
                            startIcon={<QrCode />}
                            onClick={() => handleShowQR(purchase)}
                            sx={{ mt: 1 }}
                          >
                            QR 보기
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            fullWidth
                            onClick={() => {
                              navigator.clipboard.writeText(purchase.transactionHash)
                              alert('트랜잭션 해시가 복사되었습니다!')
                            }}
                          >
                            TX 복사
                          </Button>
                        </Stack>
                      )}
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        {/* QR 코드 다이얼로그 */}
        <Dialog open={qrDialogOpen} onClose={handleCloseQR} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
            🎫 티켓 QR 코드
          </DialogTitle>
          <DialogContent sx={{ textAlign: 'center', pb: 2 }}>
            {selectedTicket && (
              <Stack spacing={2} alignItems="center">
                <Typography variant="h6" fontWeight="bold">
                  {selectedTicket.ticket.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  토큰 ID: #{selectedTicket.tokenId}
                </Typography>

                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'white',
                    borderRadius: 2,
                    boxShadow: 2,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {qrCodeDataURL ? (
                    <img
                      src={qrCodeDataURL}
                      alt="티켓 QR 코드"
                      style={{
                        maxWidth: '100%',
                        height: 'auto',
                        borderRadius: '8px',
                      }}
                    />
                  ) : (
                    <CircularProgress />
                  )}
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                  이 QR 코드를 입장 시 스캔해주세요
                </Typography>
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
            <Button onClick={handleCloseQR} variant="outlined" size="large">
              닫기
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  )
}