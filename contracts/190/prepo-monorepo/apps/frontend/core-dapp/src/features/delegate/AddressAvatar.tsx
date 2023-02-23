import { media, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import Identicon from '../connect/Identicon'
import LoadingLottie from '../../components/lottie-animations/LoadingLottie'
import useResponsive from '../../hooks/useResponsive'

export type AvatarDiameter = {
  desktop: number
  mobile: number
}

type Props = {
  loading?: boolean
  avatarUrl?: string
  address?: string
  avatarDiameter?: AvatarDiameter
}

const DEFAULT_AVATAR_DIAMETER: AvatarDiameter = {
  desktop: 40,
  mobile: 24,
}

const Wrapper = styled.div<{ src?: string; diameterDesktop: number; diameterMobile: number }>`
  background-color: ${({ theme }): string => theme.color.neutral6};
  background-image: url(${({ src }): string | undefined => src});
  background-position: top center;
  background-size: cover;
  border-radius: 50%;
  height: ${({ diameterMobile }): string => spacingIncrement(diameterMobile)};
  width: ${({ diameterMobile }): string => spacingIncrement(diameterMobile)};

  ${media.desktop<{ diameterDesktop: number }>`
    height: ${({ diameterDesktop }): string => spacingIncrement(diameterDesktop)};
    width: ${({ diameterDesktop }): string => spacingIncrement(diameterDesktop)};
  `}
`

const AddressAvatar: React.FC<Props> = ({
  loading,
  avatarUrl,
  address,
  avatarDiameter = DEFAULT_AVATAR_DIAMETER,
}) => {
  const { isDesktop } = useResponsive()

  const diameter = isDesktop ? avatarDiameter.desktop : avatarDiameter.mobile

  if (loading) {
    return <LoadingLottie height={diameter} width={diameter} />
  }

  if (avatarUrl) {
    return (
      <Wrapper
        src={avatarUrl}
        diameterDesktop={avatarDiameter.desktop}
        diameterMobile={avatarDiameter.mobile}
      />
    )
  }

  if (address) {
    return (
      <Identicon
        account={address}
        diameterDesktop={avatarDiameter.desktop}
        diameterMobile={avatarDiameter.mobile}
      />
    )
  }

  return <Wrapper diameterDesktop={avatarDiameter.desktop} diameterMobile={avatarDiameter.mobile} />
}

export default AddressAvatar
