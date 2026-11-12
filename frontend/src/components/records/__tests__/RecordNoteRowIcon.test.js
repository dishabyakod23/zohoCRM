import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RecordNoteRowIcon from '../RecordNoteRowIcon.js';
import * as notesApi from '../../../lib/services/notes.js';

jest.mock('../../../lib/services/notes.js', () => ({
  listNotes: jest.fn(),
  listNotesBatched: jest.fn(),
  supportsNotesBatch: (type) => ['lead', 'contact', 'account'].includes(type),
}));

jest.mock('../RecordNoteHoverPreview.js', () => ({ __esModule: true, default: () => null }));

describe('RecordNoteRowIcon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notesApi.listNotes.mockResolvedValue([{ id: 'n1', created_at: '2026-11-01' }]);
    notesApi.listNotesBatched.mockResolvedValue([{ id: 'n1', created_at: '2026-11-01' }]);
  });

  it('loads lead notes up front through the shared batch request', async () => {
    render(<RecordNoteRowIcon relatedType="lead" recordId="l1" onOpen={jest.fn()} />);
    await waitFor(() => expect(notesApi.listNotesBatched).toHaveBeenCalledWith('lead', 'l1'));
    expect(notesApi.listNotes).not.toHaveBeenCalled();
  });

  it('does not request campaign notes per row until the icon is hovered', async () => {
    render(<RecordNoteRowIcon relatedType="campaign" recordId="c1" onOpen={jest.fn()} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(notesApi.listNotesBatched).not.toHaveBeenCalled();
    expect(notesApi.listNotes).not.toHaveBeenCalled();

    fireEvent.mouseEnter(screen.getByRole('button'));
    await waitFor(() => expect(notesApi.listNotes).toHaveBeenCalledWith('campaign', 'c1'));
  });
});
