import React from 'react'
import styled from 'styled-components'

const Wrapper = styled.div`
  display: none;
`

interface Props {
  srcs: string[]
}

const ImagePreloader: React.FC<Props> = ({ srcs }) => (
  <Wrapper>
    {srcs.map((src) => (
      <img key={src} src={src} alt="img-preloader" />
    ))}
  </Wrapper>
)

export default ImagePreloader
