import { render } from '@solidjs/testing-library'
import { describe, expect, test } from 'vitest'

import { splitTags, Trans } from './trans'

describe('splitTags', () => {
  test('splits text and tagged parts in order', () => {
    expect(splitTags('I accept the <a>Policy</a> and <b>Terms</b>.')).toEqual([
      { text: 'I accept the ' },
      { tag: 'a', text: 'Policy' },
      { text: ' and ' },
      { tag: 'b', text: 'Terms' },
      { text: '.' },
    ])
  })

  test('keeps a string without tags whole', () => {
    expect(splitTags('plain')).toEqual([{ text: 'plain' }])
  })
})

describe('Trans', () => {
  test('renders components for tags and keeps markup in the text as text', () => {
    const { container } = render(() => (
      <Trans
        text={'Read <link>this</link> <img src=x onerror=alert(1)>'}
        components={{ link: (text) => <a href="/x">{text}</a> }}
      />
    ))

    expect(container.querySelector('a')).toHaveTextContent('this')
    expect(container.querySelector('img')).toBeNull()
    expect(container).toHaveTextContent('Read this <img src=x onerror=alert(1)>')
  })
})
