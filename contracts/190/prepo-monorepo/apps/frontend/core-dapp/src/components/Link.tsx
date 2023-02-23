import NextLink from 'next/link'
import styled from 'styled-components'

const Anchor = styled.a`
  :hover {
    color: ${({ theme }): string => theme.color.primary};
  }
`

type Props = {
  href: string
  target?: string
  className?: string
  scroll?: boolean
}

const Link: React.FC<Props> = ({ className, href, target = '_self', children, scroll }) => (
  <NextLink href={href} passHref scroll={scroll}>
    <Anchor
      className={className}
      target={target}
      rel={target === '_blank' ? 'noopener noreferrer' : ''}
    >
      {children}
    </Anchor>
  </NextLink>
)

export default Link
