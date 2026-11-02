import { describe, expect, it } from 'vitest'
import { parseEmailList } from '../email-list'

describe('parseEmailList', () => {
  it('accepts commas, semicolons, spaces and new lines', () => {
    expect(
      parseEmailList(
        'a.b@rollerdigital.com, c.d@rollerdigital.com;e.f@rollerdigital.com\ng.h@rollerdigital.com  i.j@rollerdigital.com',
      ),
    ).toEqual([
      'a.b@rollerdigital.com',
      'c.d@rollerdigital.com',
      'e.f@rollerdigital.com',
      'g.h@rollerdigital.com',
      'i.j@rollerdigital.com',
    ])
  })

  it('reads a CSV file with a header, quotes and Windows line endings', () => {
    const csv =
      'email,name\r\n"Jane.Doe@RollerDigital.com","Jane Doe"\r\njohn.roe@rollerdigital.com,John\r\n'
    expect(parseEmailList(csv)).toEqual([
      'jane.doe@rollerdigital.com',
      'john.roe@rollerdigital.com',
    ])
  })

  it('handles "Name <email>" and removes duplicates', () => {
    expect(
      parseEmailList('Jane Doe <jane.doe@rollerdigital.com>, JANE.DOE@rollerdigital.com'),
    ).toEqual(['jane.doe@rollerdigital.com'])
  })

  it('keeps invalid-looking emails so the backend can explain why they were skipped', () => {
    expect(parseEmailList('someone@gmail.com')).toEqual(['someone@gmail.com'])
    expect(parseEmailList('  \n , ')).toEqual([])
  })
})
