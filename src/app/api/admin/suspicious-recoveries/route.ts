import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/suspicious-recoveries
 * 관리자용: 의심스러운 복구 시도 패턴 조회
 *
 * Query Parameters:
 * - days: 조회 기간 (기본: 7일)
 * - minAttempts: 최소 시도 횟수 (기본: 3)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7', 10)
    const minAttempts = parseInt(searchParams.get('minAttempts') || '3', 10)

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // 1. 동일 IP에서 여러 계정 복구 시도
    const suspiciousIPs = await prisma.$queryRaw<Array<{
      ipAddress: string
      attemptCount: bigint
      successCount: bigint
      failureCount: bigint
      uniqueUsers: bigint
    }>>`
      SELECT
        "ipAddress",
        COUNT(*) as "attemptCount",
        COUNT(*) FILTER (WHERE success = true) as "successCount",
        COUNT(*) FILTER (WHERE success = false) as "failureCount",
        COUNT(DISTINCT "userId") as "uniqueUsers"
      FROM recovery_attempts
      WHERE "createdAt" >= ${startDate}
        AND "ipAddress" IS NOT NULL
        AND "ipAddress" != 'unknown'
      GROUP BY "ipAddress"
      HAVING COUNT(*) >= ${minAttempts}
      ORDER BY "attemptCount" DESC
    `

    // 2. 짧은 시간 내 여러 번 복구 성공한 사용자
    const suspiciousUsers = await prisma.$queryRaw<Array<{
      userId: string
      userName: string | null
      phoneNumber: string | null
      recoveryCount: bigint
      lastRecoveryAt: Date
      firstRecoveryAt: Date
      daysBetween: number
    }>>`
      SELECT
        ra."userId",
        u.name as "userName",
        u."phoneNumber",
        COUNT(*) as "recoveryCount",
        MAX(ra."createdAt") as "lastRecoveryAt",
        MIN(ra."createdAt") as "firstRecoveryAt",
        EXTRACT(DAY FROM MAX(ra."createdAt") - MIN(ra."createdAt")) as "daysBetween"
      FROM recovery_attempts ra
      INNER JOIN users u ON ra."userId" = u.id
      WHERE ra.success = true
        AND ra."createdAt" >= ${startDate}
      GROUP BY ra."userId", u.name, u."phoneNumber"
      HAVING COUNT(*) >= 2
      ORDER BY "recoveryCount" DESC, "daysBetween" ASC
    `

    // 3. 연속 실패 후 성공한 케이스 (무차별 대입 가능성)
    const bruteForcePatterns = await prisma.$queryRaw<Array<{
      userId: string
      userName: string | null
      phoneNumber: string | null
      failureCount: bigint
      successCount: bigint
      ipAddress: string | null
      lastAttemptAt: Date
    }>>`
      SELECT
        ra."userId",
        u.name as "userName",
        u."phoneNumber",
        COUNT(*) FILTER (WHERE ra.success = false) as "failureCount",
        COUNT(*) FILTER (WHERE ra.success = true) as "successCount",
        ra."ipAddress",
        MAX(ra."createdAt") as "lastAttemptAt"
      FROM recovery_attempts ra
      INNER JOIN users u ON ra."userId" = u.id
      WHERE ra."createdAt" >= ${startDate}
      GROUP BY ra."userId", u.name, u."phoneNumber", ra."ipAddress"
      HAVING COUNT(*) FILTER (WHERE ra.success = false) >= ${minAttempts}
        AND COUNT(*) FILTER (WHERE ra.success = true) >= 1
      ORDER BY "failureCount" DESC
    `

    // 4. 복구 후 공개키 변경이 여러 번 발생한 사용자
    const frequentKeyChanges = await prisma.publicKeyHistory.groupBy({
      by: ['userId'],
      where: {
        reason: 'RECOVERY',
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
      having: {
        id: {
          _count: {
            gte: 2,
          },
        },
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    })

    // 사용자 정보 추가 조회
    const userIds = frequentKeyChanges.map(item => item.userId)
    const usersWithKeyChanges = await prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        email: true,
        keyCreatedAt: true,
        publicKeyHistories: {
          where: {
            reason: 'RECOVERY',
            createdAt: {
              gte: startDate,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            createdAt: true,
            deviceInfo: true,
          },
        },
      },
    })

    // 5. 전체 통계
    const statistics = await prisma.recoveryAttempt.aggregate({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
    })

    const successCount = await prisma.recoveryAttempt.count({
      where: {
        createdAt: {
          gte: startDate,
        },
        success: true,
      },
    })

    const failureCount = await prisma.recoveryAttempt.count({
      where: {
        createdAt: {
          gte: startDate,
        },
        success: false,
      },
    })

    return NextResponse.json({
      success: true,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      statistics: {
        totalAttempts: statistics._count.id,
        successfulRecoveries: successCount,
        failedAttempts: failureCount,
        successRate: statistics._count.id > 0
          ? ((successCount / statistics._count.id) * 100).toFixed(2) + '%'
          : '0%',
      },
      suspiciousPatterns: {
        suspiciousIPs: suspiciousIPs.map(ip => ({
          ipAddress: ip.ipAddress,
          attemptCount: Number(ip.attemptCount),
          successCount: Number(ip.successCount),
          failureCount: Number(ip.failureCount),
          uniqueUsers: Number(ip.uniqueUsers),
          riskLevel: Number(ip.uniqueUsers) > 3 ? 'HIGH' : Number(ip.attemptCount) > 5 ? 'MEDIUM' : 'LOW',
        })),
        suspiciousUsers: suspiciousUsers.map(user => ({
          userId: user.userId,
          userName: user.userName,
          phoneNumber: user.phoneNumber,
          recoveryCount: Number(user.recoveryCount),
          lastRecoveryAt: user.lastRecoveryAt,
          firstRecoveryAt: user.firstRecoveryAt,
          daysBetween: user.daysBetween,
          riskLevel: user.daysBetween < 1 ? 'HIGH' : user.daysBetween < 7 ? 'MEDIUM' : 'LOW',
        })),
        bruteForcePatterns: bruteForcePatterns.map(pattern => ({
          userId: pattern.userId,
          userName: pattern.userName,
          phoneNumber: pattern.phoneNumber,
          failureCount: Number(pattern.failureCount),
          successCount: Number(pattern.successCount),
          ipAddress: pattern.ipAddress,
          lastAttemptAt: pattern.lastAttemptAt,
          riskLevel: Number(pattern.failureCount) > 5 ? 'HIGH' : 'MEDIUM',
        })),
        frequentKeyChanges: usersWithKeyChanges.map(user => {
          const changeCount = user.publicKeyHistories.length
          return {
            userId: user.id,
            userName: user.name,
            phoneNumber: user.phoneNumber,
            email: user.email,
            keyChangeCount: changeCount,
            currentKeyCreatedAt: user.keyCreatedAt,
            recentChanges: user.publicKeyHistories.slice(0, 5),
            riskLevel: changeCount > 3 ? 'HIGH' : changeCount > 2 ? 'MEDIUM' : 'LOW',
          }
        }),
      },
    })
  } catch (error) {
    console.error('의심스러운 복구 조회 실패:', error)
    return NextResponse.json(
      { error: '의심스러운 복구 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}