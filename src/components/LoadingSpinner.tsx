'use client'

import CircularProgress, { CircularProgressProps } from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

interface LoadingSpinnerProps {
  size?: number;
  color?: CircularProgressProps['color'];
}

export default function LoadingSpinner({ size = 40, color = 'primary' }: LoadingSpinnerProps) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <CircularProgress size={size} color={color} />
    </Box>
  );
}