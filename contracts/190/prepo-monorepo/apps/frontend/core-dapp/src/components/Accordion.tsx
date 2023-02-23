import { Icon, spacingIncrement } from 'prepo-ui'
import { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

type ContainerProps = {
  $active: boolean
}

type Props = {
  title: string | React.ReactElement
  visible?: boolean
  onChange?: (value: boolean) => void
  className?: string
  renderIcon?: (active: boolean) => JSX.Element
  hideIcon?: boolean
}

const Title = styled.button<{ $active: boolean; $hideIcon: boolean }>`
  align-items: center;
  background-color: ${({ theme, $active }): string =>
    !$active && theme.isDarkMode ? theme.color.neutral7 : theme.color.neutral10};
  border: 1px solid ${({ theme }): string => theme.color.neutral8};
  border-bottom: ${({ $active }): string => ($active ? 'none' : '')};
  color: ${({ theme }): string => theme.color.secondary};
  cursor: ${({ $hideIcon }): string => ($hideIcon ? 'default' : 'pointer')};
  display: flex;
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  justify-content: space-between;
  padding: ${spacingIncrement(10)} ${spacingIncrement(20)};
  user-select: ${({ $hideIcon }): string => ($hideIcon ? 'text' : 'auto')};
  width: 100%;
`

const ArrowIcon = styled(Icon)<{ $active: boolean }>`
  float: right;
  overflow: hidden;
  transform: ${({ $active }): string => ($active ? 'rotate(180deg)' : 'rotate(0deg)')};
  transition: all 0.3s ease-out;
`

const Container = styled.div<ContainerProps>`
  max-height: ${({ $active }): number | string => ($active ? 'auto' : '0px')};
  overflow: hidden;
  padding: 0 ${spacingIncrement(20)};

  ${({ theme, $active }): string =>
    $active
      ? `
        border: 1px solid ${theme.color.neutral8};
        border-top: none;
        padding: ${spacingIncrement(14)} ${spacingIncrement(20)};
      `
      : ''}
`

const Accordion: React.FC<Props> = ({
  className,
  title,
  visible = false,
  hideIcon = false,
  onChange,
  children,
  renderIcon,
}) => {
  const [active, setActive] = useState<boolean>(visible)

  const onActive = (): void => {
    if (hideIcon) return
    setActive(!active)
    if (onChange) onChange(!active)
  }

  useEffect(() => {
    setActive(visible)
  }, [visible])

  const icon = useMemo(() => {
    if (hideIcon) return null
    if (renderIcon) return renderIcon(active)
    return (
      <ArrowIcon color="primaryLight" $active={active} name="sort-down" width="13" height="8" />
    )
  }, [active, hideIcon, renderIcon])

  return (
    <div className={className}>
      <Title onClick={onActive} $active={active} $hideIcon={hideIcon}>
        {title}
        {icon}
      </Title>

      <Container $active={active}>{children}</Container>
    </div>
  )
}

export default Accordion
