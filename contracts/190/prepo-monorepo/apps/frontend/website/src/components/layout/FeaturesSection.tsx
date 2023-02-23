import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Intro, IntroContainer } from '../intro'
import NonBreakingText from '../NonBreakingText'

type FeatureProps = {
  title: string
  description: React.ReactNode
  srcWebp: string
  srcPng: string
}

const features: FeatureProps[] = [
  {
    title: 'Go Long or Short',
    description: (
      <span>
        Bullish or bearish about a private company or <NonBreakingText>pre-launch</NonBreakingText>{' '}
        token? Go long or short in our synthetic asset markets, and exit your position at any time.
      </span>
    ),
    srcWebp: '/images/iphone-long.webp',
    srcPng: '/images/iphone-long.png',
  },
  {
    title: 'Neutral LP Provision',
    description: (
      <span>
        Comfortably provide liquidity to prePO markets through{' '}
        <NonBreakingText>risk-minimized</NonBreakingText> positions, and utilize concentrated
        liquidity to magnify your yield.
      </span>
    ),
    srcWebp: '/images/iphone-lp.webp',
    srcPng: '/images/iphone-lp.png',
  },
  {
    title: '3 Layers of Rewards',
    description: 'Earn passive yield and token rewards to further boost your profit.',
    srcWebp: '/images/iphone-rewards.webp',
    srcPng: '/images/iphone-rewards.png',
  },
  {
    title: 'No Intermediaries',
    description: (
      <span>
        Always be in full control of your assets, and benefit from{' '}
        <NonBreakingText>low-latency</NonBreakingText>, <NonBreakingText>low-cost</NonBreakingText>{' '}
        transactions via Ethereum L2 scaling solutions.
      </span>
    ),
    srcWebp: '/images/iphone-summary.webp',
    srcPng: '/images/iphone-summary.png',
  },
]

export const FeaturesSection: FC = ({ children }) => {
  const [prevFeatureIndex, setPrevFeatureIndex] = useState(-1)
  const [selectedFeatureIndex, setSelectedFeatureIndex] = useState(0)
  const [nextFeatureProgress, setNextFeatureProgress] = useState(0)

  // manage scroll for desktop
  const refSection = useRef<HTMLDivElement>(null)
  const refFeaturesArea = useRef<HTMLDivElement>(null)
  const refTopPlaceholder = useRef<HTMLDivElement>(null)
  const refBottomPlaceholder = useRef<HTMLDivElement>(null)

  // to set a selected feature, scroll to the appropriate offset
  const setFeature = useCallback((i: number): void => {
    const layoutScrollArea = document.querySelector('#layout') as HTMLElement
    if (!layoutScrollArea) return

    const phTop = refTopPlaceholder.current as HTMLElement
    const featuresArea = refFeaturesArea.current as HTMLElement
    const height =
      (featuresArea.scrollHeight - featuresArea.clientHeight) / (features.length * features.length)

    // get to the beginging of next section, then remove 1 bar to fulfill clicked progressbar
    const additionalHeight = height * (i + 1) - 1
    layoutScrollArea.scrollTo({ top: phTop.offsetTop + additionalHeight })
  }, [])

  const { selectedFeature, prevFeature } = useMemo(
    () => ({
      selectedFeature: features[selectedFeatureIndex],
      prevFeature: prevFeatureIndex !== selectedFeatureIndex ? features[prevFeatureIndex] : null,
    }),
    [prevFeatureIndex, selectedFeatureIndex]
  )

  useEffect(() => {
    const layoutScrollArea = document.querySelector('#layout') as HTMLElement
    const layoutFooter = document.querySelector('#layout-footer') as HTMLElement
    if (!layoutScrollArea || !layoutFooter) {
      // ERROR : This component is meant to be used inside a Layout component
      return undefined
    }

    const phTop = refTopPlaceholder.current as HTMLElement
    const phBottom = refBottomPlaceholder.current as HTMLElement
    const featuresArea = refFeaturesArea.current as HTMLElement
    const section = refSection.current as HTMLElement

    const handleResize = (): void => {
      // size of the hidden part of the features scrollable area
      const additionalHeight = (featuresArea.scrollHeight - featuresArea.clientHeight) / 4

      // create spacer equal to the size of our hidden features scroll area, minus footer
      phBottom.style.minHeight = `${additionalHeight - layoutFooter.clientHeight}px`

      // set a margin equal to footer height so our section doesn't appear above the footer
      section.style.marginBottom = `${layoutFooter.clientHeight}px`
    }

    const handleScroll = (): void => {
      // set the scroll position of the features, which progress is based on
      featuresArea.scrollTop = (layoutScrollArea.scrollTop - phTop.offsetTop) * 4

      // size of the hidden part of the features scrollable area
      const additionalHeight = featuresArea.scrollHeight - featuresArea.clientHeight

      // compute progress though the features
      const progress =
        ((features.length * featuresArea.scrollTop) / additionalHeight) % (features.length + 1)

      // determine which feature is displayed based on progress
      // if at end of last feature progress, keep displaying last feature
      const featureIndex = progress === features.length ? features.length - 1 : Math.floor(progress)
      setSelectedFeatureIndex((prevIndex) => {
        const newIndex = featureIndex % features.length
        if (prevIndex !== newIndex) setPrevFeatureIndex(prevIndex)
        return newIndex
      })

      // determine progress until next feature appears
      const nextFeatProgress = Math.floor((progress - featureIndex) * 100)
      setNextFeatureProgress(nextFeatProgress)
    }

    layoutScrollArea.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)

    // force call on load
    handleResize()
    handleScroll()

    return (): void => {
      layoutScrollArea.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <>
      {/* used to get the offsetTop of the component */}
      <div ref={refTopPlaceholder} />
      <section ref={refSection} className="sticky top-0 mt-[100px]">
        <div className="relative">
          {/* visible section */}
          <div className="overflow-hidden absolute top-0 left-0 z-10 w-full h-full max-h-screen bg-white">
            <IntroContainer className="sticky top-0">
              <div className="container relative mx-auto max-w-[1440px] h-auto">
                <div className="flex flex-col justify-center items-center px-10 pb-0 min-h-[100vh] md:flex-row md:justify-between md:px-16 lg:px-32">
                  <div className="flex flex-col justify-center items-center md:items-start md:pr-10">
                    <Intro type="fadeInLTR" className="w-full text-center md:text-left ">
                      <h1 className="relative mb-6 w-full text-2xl font-bold leading-[155.8%] text-title whitespace-nowrap sm:text-[32px] lg:text-[48px] lg:leading-[137.8%]">
                        <span key={selectedFeature.title} className="block w-full animate-fadein">
                          {selectedFeature.title}
                        </span>
                        {prevFeature && (
                          <span
                            key={prevFeature.title}
                            className="absolute top-0 left-0 -z-10 w-full opacity-0 animate-fadeout"
                          >
                            {prevFeature.title}
                          </span>
                        )}
                      </h1>
                      <div className="flex grow mx-auto space-x-1 w-[200px] max-w-[75vw] sm:max-w-[50vw] md:mx-0 md:w-[260px] lg:w-[350px] xl:w-[431px]">
                        {features.map((feature, i) => (
                          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                          <progress
                            onClick={(): void => setFeature(i)}
                            key={feature.title}
                            max={100}
                            value={i === selectedFeatureIndex ? nextFeatureProgress : 0}
                            className="flex-1 w-3 h-[5.7px] transition-all hover:cursor-pointer"
                          />
                        ))}
                      </div>
                    </Intro>
                    <Intro type="fadeInUp">
                      <p className="relative mt-6 w-72 h-40 text-sm font-medium leading-[155.8%] text-center md:text-base md:text-left lg:w-[431px] lg:text-lg">
                        <span key={selectedFeature.title} className="animate-fadein">
                          {selectedFeature.description}
                        </span>
                        {prevFeature && (
                          <span
                            key={prevFeature.title}
                            className="absolute top-0 left-0 -z-10 opacity-0 animate-fadeout"
                          >
                            {prevFeature.description}
                          </span>
                        )}
                      </p>
                    </Intro>
                  </div>
                  <div className="overflow-hidden relative w-72 md:w-96 lg:w-[425px]">
                    <Intro type="slideUp">
                      <picture key={selectedFeature.title} className="animate-fadein">
                        <source
                          width="850"
                          height="962"
                          srcSet={selectedFeature.srcWebp}
                          type="image/webp"
                        />
                        <source
                          width="850"
                          height="962"
                          srcSet={selectedFeature.srcPng}
                          type="image/png"
                        />
                        <img
                          width="850"
                          height="962"
                          src={selectedFeature.srcPng}
                          alt={selectedFeature.title}
                        />
                      </picture>
                      {prevFeature && (
                        <picture
                          key={prevFeature.title}
                          className="absolute top-0 left-0 -z-10 opacity-0 animate-fadeout"
                        >
                          <source
                            width="850"
                            height="962"
                            srcSet={prevFeature.srcWebp}
                            type="image/webp"
                          />
                          <source
                            width="850"
                            height="962"
                            srcSet={prevFeature.srcPng}
                            type="image/png"
                          />
                          <img
                            width="850"
                            height="962"
                            src={prevFeature.srcPng}
                            alt={prevFeature.title}
                          />
                        </picture>
                      )}
                    </Intro>
                  </div>
                </div>
              </div>
            </IntroContainer>
          </div>
          {/* invisible scrollable section */}
          <div
            ref={refFeaturesArea}
            className="overflow-y-scroll relative invisible -z-10 max-h-screen"
          >
            {features.map((f) => (
              <div key={f.title} className="container relative mx-auto max-w-[1440px] min-h-screen">
                <div className="flex flex-col justify-center items-center px-10 pb-0 min-h-[100vh] md:flex-row md:justify-between md:px-16 lg:px-32">
                  <div className="flex flex-col justify-center items-center md:items-start md:pr-10">
                    <h1 className="relative mb-6 w-full text-2xl font-bold leading-[155.8%] text-title whitespace-nowrap sm:text-[32px] lg:text-[48px] lg:leading-[137.8%]">
                      <span key={f.title} className="block w-full animate-fadein">
                        {f.title}
                      </span>
                    </h1>
                    <div className="flex grow mx-auto space-x-1 w-[200px] max-w-[75vw] sm:max-w-[50vw] md:mx-0 md:w-[260px] lg:w-[350px] xl:w-[431px]">
                      {features.map((feature) => (
                        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                        <progress
                          key={feature.title}
                          max={100}
                          className="flex-1 w-3 h-[5.7px] transition-all hover:cursor-pointer"
                        />
                      ))}
                    </div>
                    <p className="relative mt-6 w-72 h-40 text-sm font-medium leading-[155.8%] text-center md:text-base md:text-left lg:w-[431px] lg:text-lg">
                      <span key={f.title} className="animate-fadein">
                        {f.description}
                      </span>
                    </p>
                  </div>
                  <div className="overflow-hidden relative w-72 md:w-96 lg:w-[425px]">
                    <Intro type="slideUp">
                      <picture key={f.title} className="animate-fadein">
                        <source width="850" height="962" srcSet={f.srcWebp} type="image/webp" />
                        <source width="850" height="962" srcSet={f.srcPng} type="image/png" />
                        <img width="850" height="962" src={f.srcPng} alt={f.title} />
                      </picture>
                    </Intro>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>{children}</div>
      </section>
      {/* This will have height equal to the features area overflow */}
      <div ref={refBottomPlaceholder} />
    </>
  )
}
